import { prisma } from "@/lib/prisma";
import { computeBuildingHeatLevels } from "@/lib/events";
import { isDataStale } from "@/lib/ingest/freshness";
import { ingestAllSources } from "@/lib/ingest/service";
import { MapPanel } from "@/components/map-panel";
import { EventSidebar } from "@/components/event-sidebar";
import type { HeatLevel } from "@/lib/types";
import { ErrorBoundary } from "@/components/error-boundary";
import { getCurrentPeriod } from "@/lib/radio";
import { AmbienceEngine } from "@/components/ambience-engine";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // If data is stale (>1h since last ingest), trigger background refresh.
  // The DB-level staleness check in isDataStale() naturally prevents
  // redundant ingests — once a run updates lastSuccessAt, subsequent
  // checks will return false until the next stale window.
  let stale = false;
  try {
    stale = await isDataStale();
  } catch (err) {
    console.error("Freshness check failed, skipping ingest:", err);
  }

  if (stale) {
    // Fire-and-forget with a 55s timeout to prevent runaway ingests
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

    // Safely parse aliases — column stores JSON string, but guard against malformed data
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
      heatLevel: (heat?.heatLevel ?? 0) as HeatLevel,
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

  const initialPeriod = getCurrentPeriod();

  return (
    <main className="main-shell">
      <AmbienceEngine initialPeriod={initialPeriod} />
      <EventSidebar
        buildings={buildings}
        categories={categories}
        activeBuildings={activeBuildings}
        totalEvents={totalEvents}
      />
      <section className="map-wrap">
        <ErrorBoundary>
          <MapPanel initialBuildings={buildings} categories={categories} />
        </ErrorBoundary>
      </section>
    </main>
  );
}
