import { prisma } from "@/lib/prisma";
import { computeBuildingHeatLevels } from "@/lib/events";
import { isDataStale } from "@/lib/ingest/freshness";
import { ingestAllSources } from "@/lib/ingest/service";
import { MapPanel } from "@/components/map-panel";

export const dynamic = "force-dynamic";
export const revalidate = 60; // re-render from DB every 60s

export default async function HomePage() {
  // If data is stale (>1h since last ingest), trigger background refresh.
  // The DB-level staleness check in isDataStale() naturally prevents
  // redundant ingests — once a run updates lastSuccessAt, subsequent
  // checks will return false until the next stale window.
  const stale = await isDataStale();
  if (stale) {
    ingestAllSources().catch((err) => {
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

  const heatMap = await computeBuildingHeatLevels();

  const buildings = rows.map((b) => {
    const heat = heatMap.get(b.id);
    return {
      ...b,
      campus: b.campus as "NORTH" | "SOUTH" | "OTHER",
      aliases: JSON.parse(b.aliases) as string[],
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
    <main className="main-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
          </div>
          <h1>SignalMap</h1>
        </div>
        <p className="subtle">UNC Chapel Hill</p>
        <div className="sidebar-stats">
          <div className="sidebar-stat">
            <strong>{activeBuildings}</strong>
            <span>Active</span>
          </div>
          <div className="sidebar-stat">
            <strong>{totalEvents}</strong>
            <span>Events</span>
          </div>
        </div>
      </aside>
      <section className="map-wrap">
        <MapPanel initialBuildings={buildings} categories={categories} />
      </section>
    </main>
  );
}
