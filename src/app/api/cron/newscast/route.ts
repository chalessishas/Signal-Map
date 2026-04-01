// /api/cron/newscast — Generate today's morning briefing
// Triggered daily by Vercel Cron or manually via admin
import { NextRequest, NextResponse } from "next/server";
import { generateTodayNewscast } from "@/lib/newscast";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Auth: CRON_SECRET (Vercel) or ADMIN_TOKEN (manual)
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const adminToken = process.env.ADMIN_TOKEN;
  const queryToken = req.nextUrl.searchParams.get("token");

  const authorized =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (adminToken && queryToken === adminToken);

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { episode, isNew } = await generateTodayNewscast();
    return NextResponse.json({
      ok: true,
      isNew,
      episode: {
        id: episode.id,
        date: episode.date,
        title: episode.title,
        hasAudio: !!episode.audioBase64,
      },
    });
  } catch (err) {
    console.error("Newscast generation failed:", err);
    return NextResponse.json(
      { error: "Generation failed", detail: String(err) },
      { status: 500 },
    );
  }
}
