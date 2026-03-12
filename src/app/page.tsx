import { prisma } from "@/lib/prisma";
import { computeBuildingHeatLevels } from "@/lib/events";
import { isDataStale } from "@/lib/ingest/freshness";
import { ingestAllSources } from "@/lib/ingest/service";
import { MapPanel } from "@/components/map-panel";
import { ErrorBoundary } from "@/components/error-boundary";

export const dynamic = "force-dynamic";
export const revalidate = 60; // re-render from DB every 60s

export default async function HomePage() {
  // If data is stale (>1h since last ingest), trigger background refresh.
  let stale = false;
  try {
    stale = await isDataStale();
  } catch (err) {
    console.error("Freshness check failed, skipping ingest:", err);
  }

  if (stale) {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Ingest timeout (55s)")), 55_000)
    );
    Promise.race([ingestAllSources(), timeout]).catch((err) => {
      console.error("Background ingest failed:", err);
    });
  }
  const rows = await prisma.building.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      lat: true,
      lng: true,
      campus: true,
      aliases: true,
    },
    orderBy: [{ campus: "asc" }, { name: "asc" }],
  });

  let heatMap: Map<string, { eventCount: number; heatLevel: number; happeningNowCount: number; nextEventStartsAt: Date | null; cleCount: number }>;
  try {
    heatMap = await computeBuildingHeatLevels();
  } catch (err) {
    console.error("Failed to compute heat levels:", err);
    heatMap = new Map();
  }

  const buildings = rows.map((b) => {
    const heat = heatMap.get(b.id);

    let aliases: string[] = [];
    try {
      const parsed = JSON.parse(b.aliases);
      if (Array.isArray(parsed)) aliases = parsed;
    } catch {
      console.warn(`Malformed aliases JSON for building ${b.id}:`, b.aliases);
    }

    return {
      ...b,
      campus: b.campus as "NORTH" | "SOUTH" | "OTHER",
      aliases,
      eventCount: heat?.eventCount ?? 0,
      heatLevel: heat?.heatLevel ?? 0 as const,
      happeningNowCount: heat?.happeningNowCount ?? 0,
      nextEventStartsAt: heat?.nextEventStartsAt?.toISOString() ?? null,
      cleCount: heat?.cleCount ?? 0,
    };
  });

  // Get distinct categories for the filter bar
  const categoryRows = await prisma.event.findMany({
    where: { status: "ACTIVE", category: { not: null } },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });
  const categories = categoryRows
    .map((r) => r.category)
    .filter((c): c is string => c !== null);

  const totalEvents = await prisma.event.count({ where: { status: "ACTIVE" } });
  const activeBuildings = buildings.filter((b) => b.heatLevel > 0).length;

  return (
    <main className="constellation-shell">
      {/* Compact brand watermark — bottom-left */}
      <div className="brand-watermark">
        <div className="brand-watermark-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
        </div>
        <span className="brand-watermark-text">SignalMap</span>
        <span className="brand-watermark-stats">{activeBuildings} active &middot; {totalEvents} events</span>
      </div>

      <section className="map-wrap">
        <ErrorBoundary>
          <MapPanel initialBuildings={buildings} categories={categories} />
        </ErrorBoundary>
      </section>
    </main>
  );
}
