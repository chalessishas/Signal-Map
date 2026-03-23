import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken || token !== adminToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [
    totalEvents,
    activeEvents,
    cancelledEvents,
    totalBuildings,
    matchedEventsCount,
    unmatchedEventsCount,
    sources,
    recentLogs,
    categoryBreakdown,
    topBuildings,
  ] = await Promise.all([
    prisma.event.count(),
    prisma.event.count({ where: { status: "ACTIVE" } }),
    prisma.event.count({ where: { status: "CANCELLED" } }),
    prisma.building.count(),
    prisma.event.count({ where: { status: "ACTIVE", buildingId: { not: null } } }),
    prisma.event.count({ where: { status: "ACTIVE", buildingId: null } }),
    prisma.eventSource.findMany({
      select: {
        id: true,
        name: true,
        parserType: true,
        url: true,
        lastSuccessAt: true,
        lastError: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.ingestLog.findMany({
      select: {
        id: true,
        sourceId: true,
        runAt: true,
        newCount: true,
        updatedCount: true,
        errorCount: true,
        rawError: true,
        source: { select: { name: true } },
      },
      orderBy: { runAt: "desc" },
      take: 20,
    }),
    prisma.event.groupBy({
      by: ["category"],
      where: { status: "ACTIVE", category: { not: null } },
      _count: true,
      orderBy: { _count: { category: "desc" } },
      take: 15,
    }),
    prisma.event.groupBy({
      by: ["buildingId"],
      where: { status: "ACTIVE", buildingId: { not: null } },
      _count: true,
      orderBy: { _count: { buildingId: "desc" } },
      take: 10,
    }),
  ]);

  // Resolve building names for top buildings
  const buildingIds = topBuildings
    .map((b) => b.buildingId)
    .filter((id): id is string => id !== null);
  const buildingNames = await prisma.building.findMany({
    where: { id: { in: buildingIds } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(buildingNames.map((b) => [b.id, b.name]));

  const matchRate = activeEvents > 0
    ? Math.round((matchedEventsCount / (matchedEventsCount + unmatchedEventsCount)) * 100)
    : 0;

  return NextResponse.json({
    overview: {
      totalEvents,
      activeEvents,
      cancelledEvents,
      totalBuildings,
      matchedEventsCount,
      unmatchedEventsCount,
      matchRate,
    },
    sources,
    recentLogs: recentLogs.map((log) => ({
      ...log,
      sourceName: log.source.name,
    })),
    categoryBreakdown: categoryBreakdown.map((c) => ({
      category: c.category ?? "Uncategorized",
      count: c._count,
    })),
    topBuildings: topBuildings.map((b) => ({
      buildingId: b.buildingId,
      name: nameMap.get(b.buildingId!) ?? "Unknown",
      count: b._count,
    })),
    generatedAt: new Date().toISOString(),
  });
}
