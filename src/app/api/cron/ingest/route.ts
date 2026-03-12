import { NextRequest, NextResponse } from "next/server";
import { ingestAllSources } from "@/lib/ingest/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // allow up to 60s for ingestion

/**
 * GET /api/cron/ingest
 *
 * Triggers a full ingest of all event sources.
 * Requires ADMIN_TOKEN via query param or Authorization header.
 *
 * Can be called by:
 *   - Vercel Cron (vercel.json — set CRON_SECRET)
 *   - External cron: curl "localhost:3000/api/cron/ingest?token=YOUR_TOKEN"
 *   - Internal background trigger from page load (bypasses auth)
 */
export async function GET(request: NextRequest) {
  // Protect external access — require valid token or Vercel Cron secret
  const adminToken = process.env.ADMIN_TOKEN;
  if (adminToken) {
    const queryToken = request.nextUrl.searchParams.get("token");
    const headerToken = request.headers.get("authorization")?.replace("Bearer ", "");
    const cronSecret = request.headers.get("x-vercel-cron-secret");

    const isVercelCron = !!(cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET);
    const isAuthed = queryToken === adminToken || headerToken === adminToken;

    // Internal server-side calls must include a secret header to prove they originate
    // from our own server code, not from an external request with no referer.
    const internalSecret = request.headers.get("x-internal-secret");
    const isInternal = !!(internalSecret && process.env.ADMIN_TOKEN && internalSecret === process.env.ADMIN_TOKEN);

    if (!isVercelCron && !isAuthed && !isInternal) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const results = await ingestAllSources();
    const totalNew = results.reduce((s, r) => s + r.newCount, 0);
    const totalUpdated = results.reduce((s, r) => s + r.updatedCount, 0);

    return NextResponse.json({
      ok: true,
      sources: results.length,
      newEvents: totalNew,
      updatedEvents: totalUpdated,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
