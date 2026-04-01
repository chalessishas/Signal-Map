// /api/newscast — Fetch today's (or recent) newscast episodes
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const dateParam = req.nextUrl.searchParams.get("date"); // YYYY-MM-DD
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "1"), 7);

  if (dateParam) {
    // Fetch specific date
    const target = new Date(dateParam + "T00:00:00.000Z");
    const episode = await prisma.newscastEpisode.findUnique({
      where: { date: target },
    });
    if (!episode) {
      return NextResponse.json({ episode: null });
    }
    return NextResponse.json({
      episode: {
        id: episode.id,
        date: episode.date,
        title: episode.title,
        script: episode.script,
        hasAudio: !!episode.audioBase64,
        audioBase64: episode.audioBase64,
        sources: JSON.parse(episode.sources),
        weather: episode.weather ? JSON.parse(episode.weather) : null,
        createdAt: episode.createdAt,
      },
    });
  }

  // Fetch most recent episodes
  const episodes = await prisma.newscastEpisode.findMany({
    orderBy: { date: "desc" },
    take: limit,
    select: {
      id: true,
      date: true,
      title: true,
      script: true,
      audioBase64: true,
      sources: true,
      weather: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    episodes: episodes.map((ep) => ({
      id: ep.id,
      date: ep.date,
      title: ep.title,
      script: ep.script,
      hasAudio: !!ep.audioBase64,
      audioBase64: ep.audioBase64,
      sources: JSON.parse(ep.sources),
      weather: ep.weather ? JSON.parse(ep.weather) : null,
      createdAt: ep.createdAt,
    })),
  });
}
