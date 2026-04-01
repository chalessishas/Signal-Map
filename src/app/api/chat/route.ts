// /api/chat — AI activity recommendations based on real event data
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { message } = await req.json();
  if (!message || typeof message !== "string" || message.length > 500) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Chat unavailable" }, { status: 503 });
  }

  // Fetch today's + tomorrow's active events for context
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 2);

  const events = await prisma.event.findMany({
    where: {
      status: "ACTIVE",
      startTime: { gte: now, lte: tomorrow },
    },
    orderBy: { startTime: "asc" },
    take: 30,
    include: { building: { select: { name: true } } },
  });

  const eventLines = events.map((e) => {
    const loc = e.building?.name ?? e.locationText ?? "TBD";
    const time = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(e.startTime);
    const cle = e.isCLE ? " [CLE]" : "";
    return `- ${e.title} | ${loc} | ${time}${cle}${e.category ? ` | ${e.category}` : ""}`;
  }).join("\n");

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
          content: `You are Signal, a friendly UNC Chapel Hill campus assistant on SignalMap (hdmap.live). You help students find activities and events.

You have access to real-time campus event data. Answer based ONLY on the events listed below. If no events match the question, say so honestly.

Be concise (2-5 sentences), warm, and helpful. Use the event name, location, and time in your recommendations. If an event is marked [CLE], mention it gives Campus Life Experience credit. Reply in the same language the user writes in.

Current events (next 48 hours):
${eventLines || "No events found in the next 48 hours."}`,
        },
        { role: "user", content: message },
      ],
      max_tokens: 300,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "AI unavailable" }, { status: 502 });
  }

  const data = await res.json();
  const reply = data.choices[0].message.content.trim();

  return NextResponse.json({ reply });
}
