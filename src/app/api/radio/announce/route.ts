// src/app/api/radio/announce/route.ts
import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  type Period,
  getCurrentPeriod,
  generateAnnouncementText,
  synthesizeSpeech,
} from "@/lib/radio";

export const dynamic = "force-dynamic";

const VALID_PERIODS = new Set<Period>(["morning", "daytime", "evening", "night"]);

// Cache announcement per period for 10 minutes — avoids redundant DeepSeek + DashScope calls
const getCachedAnnouncement = unstable_cache(
  async (period: Period) => {
    // Fetch upcoming events (next 3 hours)
    const now = new Date();
    const threeHoursLater = new Date(now.getTime() + 3 * 60 * 60 * 1000);

    let eventsDescription = "";
    try {
      const events = await prisma.event.findMany({
        where: {
          status: "ACTIVE",
          startTime: { gte: now, lte: threeHoursLater },
        },
        orderBy: { startTime: "asc" },
        take: 3,
        include: { building: { select: { name: true } } },
      });

      if (events.length > 0) {
        eventsDescription = events
          .map((e) => {
            const loc = e.building?.name ?? e.locationText ?? "campus";
            const time = new Intl.DateTimeFormat("en-US", {
              timeZone: "America/New_York",
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            }).format(e.startTime);
            return `"${e.title}" at ${loc} (${time})`;
          })
          .join("; ");
      }
    } catch (err) {
      console.error("Failed to fetch events for announcement:", err);
    }

    // Generate text with DeepSeek
    const text = await generateAnnouncementText(period, eventsDescription);

    // Synthesize with DashScope TTS
    let audio: string | null = null;
    try {
      audio = await synthesizeSpeech(text);
    } catch (err) {
      console.error("DashScope TTS failed:", err);
    }

    return { period, text, audio };
  },
  ["radio-announce"],
  { revalidate: 600, tags: ["radio-announce"] },
);

export async function GET(req: NextRequest) {
  const rawPeriod = req.nextUrl.searchParams.get("period");
  if (rawPeriod && !VALID_PERIODS.has(rawPeriod as Period)) {
    return NextResponse.json(
      { error: `Invalid period "${rawPeriod}". Must be one of: morning, daytime, evening, night.` },
      { status: 400 },
    );
  }
  const period: Period = (rawPeriod as Period) || getCurrentPeriod();

  try {
    const result = await getCachedAnnouncement(period);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Announcement generation failed:", err);
    return NextResponse.json({ period, text: null, audio: null });
  }
}
