// src/lib/newscast.ts
// Campus morning briefing: RSS news + weather + today's events → AI script → TTS

import { prisma } from "@/lib/prisma";
import { generateAnnouncementText, synthesizeSpeech } from "@/lib/radio";

// ── RSS Sources ──

type NewsItem = { title: string; url: string; source: string; summary?: string };

const RSS_FEEDS = [
  {
    name: "Daily Tar Heel",
    url: "https://www.dailytarheel.com/xml/feed/firehose.xml",
  },
  {
    name: "UNC The Well",
    url: "https://www.unc.edu/feed/",
  },
  {
    name: "Chapelboro",
    url: "https://chapelboro.com/category/news/feed",
  },
];

/** Parse RSS XML into news items. Lightweight, no external dependency. */
function parseRssItems(xml: string, sourceName: string, limit: number): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
    const block = match[1];
    const title = block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() ?? "";
    const link = block.match(/<link>(.*?)<\/link>/)?.[1]?.trim() ?? "";
    const desc = block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1]?.trim() ?? "";
    // Strip HTML tags from description
    const summary = desc.replace(/<[^>]+>/g, "").slice(0, 200);
    if (title) items.push({ title, url: link, source: sourceName, summary });
  }
  return items;
}

export async function fetchNews(): Promise<NewsItem[]> {
  const allItems: NewsItem[] = [];

  for (const feed of RSS_FEEDS) {
    try {
      const res = await fetch(feed.url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SignalMap/1.0; +https://hdmap.live)",
          "Accept": "application/rss+xml, application/xml, text/xml, */*",
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) continue;
      const xml = await res.text();
      // DTH via Google News: take top 5, others: top 3
      const limit = feed.name === "Daily Tar Heel" ? 5 : 3;
      allItems.push(...parseRssItems(xml, feed.name, limit));
    } catch {
      // Skip failing feeds silently
    }
  }

  return allItems;
}

// ── Weather ──

type Weather = { temp: number; condition: string; high: number; low: number };

export async function fetchWeather(): Promise<Weather | null> {
  try {
    const res = await fetch(
      "https://api.weather.gov/gridpoints/RAH/59,62/forecast",
      {
        headers: { "User-Agent": "SignalMap-Newscast/1.0 (hdmap.live)" },
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const today = data.properties?.periods?.[0];
    const tonight = data.properties?.periods?.[1];
    if (!today) return null;
    return {
      temp: today.temperature,
      condition: today.shortForecast,
      high: today.temperature,
      low: tonight?.temperature ?? today.temperature - 10,
    };
  } catch {
    return null;
  }
}

// ── Today's Events ──

async function fetchTodayEvents(): Promise<string> {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const events = await prisma.event.findMany({
    where: {
      status: "ACTIVE",
      startTime: { gte: now, lte: endOfDay },
    },
    orderBy: { startTime: "asc" },
    take: 5,
    include: { building: { select: { name: true } } },
  });

  if (events.length === 0) return "";

  return events
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

// ── Script Generation ──

export async function generateNewscastScript(
  news: NewsItem[],
  weather: Weather | null,
  eventsDesc: string,
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY not set");

  const dateStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  const weatherLine = weather
    ? `Weather: ${weather.temp}°F, ${weather.condition}. High ${weather.high}°F, low ${weather.low}°F.`
    : "Weather data unavailable.";

  const newsLines = news.length > 0
    ? news.map((n, i) => `${i + 1}. [${n.source}] ${n.title}${n.summary ? ` — ${n.summary}` : ""}`).join("\n")
    : "No major news today.";

  const eventsLine = eventsDesc
    ? `Today's campus events: ${eventsDesc}`
    : "No major events on campus today.";

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: `You are "Signal," the AI anchor of Tar Heel Morning Brief — a 2-3 minute campus radio news segment for UNC Chapel Hill students.

Style: warm, concise, conversational — like a friend catching you up over coffee. Use natural transitions between topics. Reference "we" and "our campus." End with an upbeat sign-off.

Structure:
1. Greeting + date + weather (2 sentences)
2. Top news stories (1-2 sentences each, max 4 stories)
3. Campus events highlight (1-2 sentences)
4. Sign-off with encouragement

Keep total length under 400 words. Speak in English only.`,
        },
        {
          role: "user",
          content: `Date: ${dateStr}\n\n${weatherLine}\n\nTop stories:\n${newsLines}\n\n${eventsLine}\n\nGenerate the morning briefing script.`,
        },
      ],
      max_tokens: 600,
      temperature: 0.8,
    }),
  });

  if (!res.ok) throw new Error(`DeepSeek API error: ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

// ── Full Pipeline ──

export async function generateTodayNewscast(): Promise<{
  episode: { id: string; date: Date; title: string; script: string; audioBase64: string | null };
  isNew: boolean;
}> {
  // Check if today's episode already exists
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  const existing = await prisma.newscastEpisode.findUnique({
    where: { date: todayMidnight },
  });

  if (existing) {
    return { episode: existing, isNew: false };
  }

  // Generate new episode
  const [news, weather, eventsDesc] = await Promise.all([
    fetchNews(),
    fetchWeather(),
    fetchTodayEvents(),
  ]);

  const script = await generateNewscastScript(news, weather, eventsDesc);

  const dateStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  const title = `Tar Heel Morning Brief — ${dateStr}`;

  // TTS
  let audioBase64: string | null = null;
  try {
    audioBase64 = await synthesizeSpeech(script);
  } catch (err) {
    console.error("Newscast TTS failed:", err);
  }

  const episode = await prisma.newscastEpisode.create({
    data: {
      date: todayMidnight,
      title,
      script,
      audioBase64,
      sources: JSON.stringify(news.map((n) => ({ title: n.title, url: n.url, source: n.source }))),
      weather: weather ? JSON.stringify(weather) : null,
    },
  });

  return { episode, isNew: true };
}
