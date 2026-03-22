// src/lib/radio.ts

export type Period = "morning" | "daytime" | "evening" | "night";

export type PeriodConfig = {
  label: string;
  emotion: string;
  announcementInterval: number; // every N tracks
};

export const PERIOD_CONFIG: Record<Period, PeriodConfig> = {
  morning: { label: "Morning", emotion: "cheerful, energetic, upbeat", announcementInterval: 2 },
  daytime: { label: "Daytime", emotion: "calm, steady, relaxed", announcementInterval: 4 },
  evening: { label: "Evening", emotion: "warm, friendly, inviting", announcementInterval: 3 },
  night:   { label: "Night",   emotion: "soft, soothing, gentle whisper", announcementInterval: 6 },
};

/** Returns the current period based on US Eastern time. */
export function getCurrentPeriod(now = new Date()): Period {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    hour12: false,
  });
  const hour = parseInt(formatter.format(now), 10);

  if (hour >= 7 && hour < 9) return "morning";
  if (hour >= 9 && hour < 17) return "daytime";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

export type Track = {
  title: string;
  artist: string;
  file: string;
  duration: number;
};

export type Manifest = Record<Period, Track[]>;

/** Shuffle an array (Fisher-Yates). */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Call DeepSeek to generate announcement text. */
export async function generateAnnouncementText(
  period: Period,
  eventsDescription: string,
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY not set");

  const config = PERIOD_CONFIG[period];
  const etTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date());

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
          content: `You are a UNC Chapel Hill campus radio host. Speak in English. Tone: ${config.emotion}. Keep it under 60 words. Be natural and human.`,
        },
        {
          role: "user",
          content: `It's ${etTime} ET. ${eventsDescription ? `Upcoming events: ${eventsDescription}.` : "No major events right now."} Give a short radio transition.`,
        },
      ],
      max_tokens: 150,
      temperature: 0.9,
    }),
  });

  if (!res.ok) throw new Error(`DeepSeek API error: ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

/** Call ElevenLabs to synthesize speech from text. Returns base64 MP3. */
export async function synthesizeSpeech(text: string): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) throw new Error("ElevenLabs env vars not set");

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.4, similarity_boost: 0.75 },
      }),
    },
  );

  if (!res.ok) {
    const status = res.status;
    throw new Error(`ElevenLabs API error: ${status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return base64;
}
