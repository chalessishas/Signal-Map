# AI Campus Radio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 24-hour AI radio to Signal-Map that changes music, map visuals, and AI announcer personality based on time of day (ET timezone).

**Architecture:** Four-layer system: (1) `radio.ts` lib with time-period logic + API wrappers, (2) two API routes for playlist and AI announcements, (3) `AmbienceEngine` client component for visual time-period transitions, (4) `RadioPlayer` client component for audio playback UI. Music served from `/public/radio/` via a build-time manifest.

**Tech Stack:** Next.js 15 (App Router), DeepSeek API, ElevenLabs TTS API, HTML5 Audio API, CSS custom properties with JS interpolation.

**Spec:** `docs/superpowers/specs/2026-03-21-ai-campus-radio-design.md`

---

## File Structure

### New files:
| File | Responsibility |
|------|---------------|
| `src/lib/radio.ts` | Time-period calculation (ET), period config (emotions, intervals), DeepSeek + ElevenLabs API wrappers |
| `src/components/ambience-engine.tsx` | Client component: watches time period, interpolates CSS variables over 30s, sets `data-period` |
| `src/components/radio-player.tsx` | Client component: audio queue management, play/pause/volume UI, announcement insertion |
| `src/app/api/radio/playlist/route.ts` | GET: returns shuffled track list for a given period from manifest |
| `src/app/api/radio/announce/route.ts` | GET: queries events → DeepSeek text → ElevenLabs TTS → returns base64 audio |
| `scripts/build-radio-manifest.ts` | Build-time script: scans `/public/radio/{period}/` dirs, outputs `manifest.json` |
| `public/radio/manifest.json` | Generated track index (title, file path, period) |
| `public/radio/morning/` | Placeholder dir for morning tracks |
| `public/radio/daytime/` | Placeholder dir for daytime tracks |
| `public/radio/evening/` | Placeholder dir for evening tracks |
| `public/radio/night/` | Placeholder dir for night tracks |

### Modified files:
| File | Change |
|------|--------|
| `src/app/globals.css` | Add `[data-period="..."]` CSS filter rules + `.radio-player` styles |
| `src/app/page.tsx` | Compute initial period on server, pass as prop, render `<AmbienceEngine>` |
| `src/components/map-panel.tsx` | Render `<RadioPlayer>` inside the map area |
| `package.json` | Add `build:radio` script |
| `.env` | Add `DEEPSEEK_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` |

---

## Task 1: Core radio library (`src/lib/radio.ts`)

**Files:**
- Create: `src/lib/radio.ts`

- [ ] **Step 1: Create radio.ts with period logic and types**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/radio.ts
git commit -m "feat(radio): add core library — period logic, DeepSeek + ElevenLabs wrappers"
```

---

## Task 2: Build-time radio manifest script

**Files:**
- Create: `scripts/build-radio-manifest.ts`
- Create: `public/radio/morning/.gitkeep`
- Create: `public/radio/daytime/.gitkeep`
- Create: `public/radio/evening/.gitkeep`
- Create: `public/radio/night/.gitkeep`
- Create: `public/radio/manifest.json` (initial empty)
- Modify: `package.json`

- [ ] **Step 1: Create placeholder directories and a sample manifest**

```bash
mkdir -p public/radio/morning public/radio/daytime public/radio/evening public/radio/night
touch public/radio/morning/.gitkeep public/radio/daytime/.gitkeep public/radio/evening/.gitkeep public/radio/night/.gitkeep
```

- [ ] **Step 2: Write the manifest builder script**

```typescript
// scripts/build-radio-manifest.ts
import fs from "fs";
import path from "path";

type Track = { title: string; artist: string; file: string; duration: number };
type Manifest = Record<string, Track[]>;

const RADIO_DIR = path.join(process.cwd(), "public", "radio");
const PERIODS = ["morning", "daytime", "evening", "night"];

const manifest: Manifest = {};

for (const period of PERIODS) {
  const dir = path.join(RADIO_DIR, period);
  if (!fs.existsSync(dir)) {
    manifest[period] = [];
    continue;
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".mp3"));
  manifest[period] = files.map((f) => {
    const name = f.replace(".mp3", "");
    // Convention: "artist - title.mp3" or just "title.mp3"
    const parts = name.split(" - ");
    return {
      title: parts.length > 1 ? parts[1].trim() : parts[0].trim(),
      artist: parts.length > 1 ? parts[0].trim() : "Unknown",
      file: `/radio/${period}/${f}`,
      duration: 0, // Duration can be filled later with an audio probe
    };
  });
}

const outPath = path.join(RADIO_DIR, "manifest.json");
fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2));
console.log(`Radio manifest written: ${Object.values(manifest).flat().length} tracks total`);
```

- [ ] **Step 3: Write initial empty manifest.json**

```json
{
  "morning": [],
  "daytime": [],
  "evening": [],
  "night": []
}
```

Write this to `public/radio/manifest.json`.

- [ ] **Step 4: Add build:radio script to package.json**

Add to the `"scripts"` section:

```json
"build:radio": "tsx scripts/build-radio-manifest.ts"
```

- [ ] **Step 5: Commit**

```bash
git add scripts/build-radio-manifest.ts public/radio/ package.json
git commit -m "feat(radio): add manifest builder script + placeholder directories"
```

---

## Task 3: Playlist API route

**Files:**
- Create: `src/app/api/radio/playlist/route.ts`

- [ ] **Step 1: Write the playlist route**

```typescript
// src/app/api/radio/playlist/route.ts
import { NextRequest, NextResponse } from "next/server";
import { type Period, type Manifest, shuffle } from "@/lib/radio";
import manifestData from "../../../../../public/radio/manifest.json";

const VALID_PERIODS = ["morning", "daytime", "evening", "night"] as const;

export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get("period") as Period | null;

  if (!period || !VALID_PERIODS.includes(period)) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }

  const manifest = manifestData as Manifest;
  const tracks = shuffle(manifest[period] ?? []);

  return NextResponse.json({ period, tracks });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/radio/playlist/route.ts
git commit -m "feat(radio): add /api/radio/playlist route"
```

---

## Task 4: Announce API route

**Files:**
- Create: `src/app/api/radio/announce/route.ts`

- [ ] **Step 1: Write the announce route**

```typescript
// src/app/api/radio/announce/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  type Period,
  getCurrentPeriod,
  generateAnnouncementText,
  synthesizeSpeech,
} from "@/lib/radio";

export const revalidate = 900; // cache for 15 minutes

export async function GET(req: NextRequest) {
  const period = (req.nextUrl.searchParams.get("period") as Period) || getCurrentPeriod();

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
  let text: string;
  try {
    text = await generateAnnouncementText(period, eventsDescription);
  } catch (err) {
    console.error("DeepSeek failed:", err);
    return NextResponse.json({ period, text: null, audio: null });
  }

  // Synthesize with ElevenLabs
  let audio: string | null = null;
  try {
    audio = await synthesizeSpeech(text);
  } catch (err) {
    console.error("ElevenLabs failed:", err);
    // Fallback: return text only, no audio
  }

  return NextResponse.json({ period, text, audio });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/radio/announce/route.ts
git commit -m "feat(radio): add /api/radio/announce route — DeepSeek + ElevenLabs"
```

---

## Task 5: AmbienceEngine component + CSS

**Files:**
- Create: `src/components/ambience-engine.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Write AmbienceEngine component**

```tsx
// src/components/ambience-engine.tsx
"use client";

import { useEffect, useRef } from "react";
import { getCurrentPeriod, type Period } from "@/lib/radio";

export function AmbienceEngine({ initialPeriod }: { initialPeriod: Period }) {
  const currentRef = useRef<Period>(initialPeriod);

  useEffect(() => {
    // Set initial period immediately (matches SSR)
    document.documentElement.setAttribute("data-period", initialPeriod);

    const interval = setInterval(() => {
      const newPeriod = getCurrentPeriod();
      if (newPeriod !== currentRef.current) {
        currentRef.current = newPeriod;
        document.documentElement.setAttribute("data-period", newPeriod);
      }
    }, 60_000); // check every minute

    return () => clearInterval(interval);
  }, [initialPeriod]);

  return null; // no visual output
}
```

- [ ] **Step 2: Add period CSS rules to globals.css**

Append after the `[data-theme="dark"]` block (around line 123):

```css
/* ═══ Time Period Ambience ═══ */

[data-period="morning"] .leaflet-tile-pane {
  filter: saturate(1.15) hue-rotate(-8deg) brightness(1.05);
  transition: filter 30s ease;
}
[data-period="daytime"] .leaflet-tile-pane {
  filter: var(--map-filter);
  transition: filter 30s ease;
}
[data-period="evening"] .leaflet-tile-pane {
  filter: saturate(1.2) hue-rotate(15deg) brightness(0.92);
  transition: filter 30s ease;
}
[data-period="night"] .leaflet-tile-pane {
  filter: brightness(0.6) saturate(0.7) contrast(1.1);
  transition: filter 30s ease;
}
```

- [ ] **Step 3: Modify page.tsx to include AmbienceEngine**

In `src/app/page.tsx`, add import and compute period server-side:

Add import at top:
```typescript
import { getCurrentPeriod } from "@/lib/radio";
import { AmbienceEngine } from "@/components/ambience-engine";
```

Inside `HomePage()` function, before the return statement, add:
```typescript
const initialPeriod = getCurrentPeriod();
```

In the JSX return, add `<AmbienceEngine>` right after opening `<main>`:
```tsx
<main className="main-shell">
  <AmbienceEngine initialPeriod={initialPeriod} />
  <aside className="sidebar">
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ambience-engine.tsx src/app/globals.css src/app/page.tsx
git commit -m "feat(radio): add AmbienceEngine — time-period visual transitions"
```

---

## Task 6: RadioPlayer component

**Files:**
- Create: `src/components/radio-player.tsx`
- Modify: `src/app/globals.css` (add player styles)
- Modify: `src/components/map-panel.tsx` (render player)

- [ ] **Step 1: Write RadioPlayer component**

```tsx
// src/components/radio-player.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  getCurrentPeriod,
  PERIOD_CONFIG,
  type Period,
  type Track,
} from "@/lib/radio";

const PERIOD_ICONS: Record<Period, string> = {
  morning: "\u2600\uFE0F",
  daytime: "\u{1F324}\uFE0F",
  evening: "\u{1F305}",
  night: "\u{1F319}",
};

export function RadioPlayer() {
  const [period, setPeriod] = useState<Period>(getCurrentPeriod);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [announcementText, setAnnouncementText] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<Track[]>([]);
  const queueIndexRef = useRef(0);
  const tracksSinceAnnounceRef = useRef(0);

  // Ensure audio element exists
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = volume;
    }
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  // Sync volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Check period every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const newPeriod = getCurrentPeriod();
      if (newPeriod !== period) setPeriod(newPeriod);
    }, 60_000);
    return () => clearInterval(interval);
  }, [period]);

  const fetchPlaylist = useCallback(async (p: Period) => {
    try {
      const res = await fetch(`/api/radio/playlist?period=${p}`);
      const data = await res.json();
      queueRef.current = data.tracks ?? [];
      queueIndexRef.current = 0;
    } catch {
      queueRef.current = [];
    }
  }, []);

  const playNext = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    const config = PERIOD_CONFIG[period];

    // Check if we should play an announcement
    if (tracksSinceAnnounceRef.current >= config.announcementInterval) {
      tracksSinceAnnounceRef.current = 0;
      try {
        const res = await fetch(`/api/radio/announce?period=${period}`);
        const data = await res.json();
        if (data.audio) {
          setAnnouncementText(data.text);
          audio.src = `data:audio/mp3;base64,${data.audio}`;
          audio.onended = () => {
            setAnnouncementText(null);
            playNextTrack();
          };
          await audio.play();
          return;
        } else if (data.text) {
          setAnnouncementText(data.text);
          setTimeout(() => setAnnouncementText(null), 5000);
        }
      } catch {
        // Skip announcement on failure
      }
    }

    playNextTrack();
  }, [period]);

  const playNextTrack = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || queueRef.current.length === 0) return;

    // Loop queue
    if (queueIndexRef.current >= queueRef.current.length) {
      queueIndexRef.current = 0;
    }

    const track = queueRef.current[queueIndexRef.current];
    queueIndexRef.current++;
    tracksSinceAnnounceRef.current++;

    setCurrentTrack(track);
    audio.src = track.file;
    audio.onended = () => playNext();
    audio.play().catch(() => setIsPlaying(false));
  }, [playNext]);

  const handleTogglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      if (queueRef.current.length === 0) {
        await fetchPlaylist(period);
      }
      if (queueRef.current.length > 0 && !audio.src) {
        playNextTrack();
      } else {
        audio.play().catch(() => {});
      }
      setIsPlaying(true);
    }
  }, [isPlaying, period, fetchPlaylist, playNextTrack]);

  // When period changes, reload playlist after current track ends
  useEffect(() => {
    if (!isPlaying) return;
    const audio = audioRef.current;
    if (!audio) return;

    const handlePeriodSwitch = async () => {
      await fetchPlaylist(period);
      playNextTrack();
    };

    // Wait for current track to end, then switch
    const originalOnEnded = audio.onended;
    audio.onended = () => {
      handlePeriodSwitch();
    };

    return () => {
      audio.onended = originalOnEnded;
    };
  }, [period]);

  return (
    <div className={`radio-player${expanded ? " radio-player--expanded" : ""}`}>
      <div className="radio-player-bar" onClick={() => setExpanded((e) => !e)}>
        <span className="radio-period-icon">{PERIOD_ICONS[period]}</span>

        <button
          type="button"
          className="radio-play-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleTogglePlay();
          }}
          aria-label={isPlaying ? "Pause radio" : "Play radio"}
        >
          {isPlaying ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          )}
        </button>

        <div className="radio-track-info">
          {announcementText ? (
            <span className="radio-announcement">{announcementText}</span>
          ) : currentTrack ? (
            <span className="radio-track-name">{currentTrack.artist !== "Unknown" ? `${currentTrack.artist} — ${currentTrack.title}` : currentTrack.title}</span>
          ) : (
            <span className="radio-track-name">Campus Radio</span>
          )}
        </div>
      </div>

      {expanded && (
        <div className="radio-player-detail">
          <div className="radio-volume">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="radio-volume-slider"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="radio-period-label">
            {PERIOD_ICONS[period]} {PERIOD_CONFIG[period].label}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add RadioPlayer CSS to globals.css**

Append to the end of `globals.css`:

```css
/* ═══ Radio Player ═══ */

.radio-player {
  position: absolute;
  bottom: 24px;
  right: 24px;
  z-index: 1000;
  background: var(--panel-bg);
  backdrop-filter: var(--panel-blur);
  border: 1px solid var(--panel-border);
  border-radius: var(--radius);
  box-shadow: var(--panel-shadow);
  overflow: hidden;
  min-width: 200px;
  max-width: 320px;
  transition: all 0.3s ease;
}

.radio-player-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  cursor: pointer;
  user-select: none;
}

.radio-period-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.radio-play-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: var(--accent);
  color: var(--text-inverse);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.2s ease;
}

.radio-play-btn:hover {
  background: var(--accent-hover);
}

.radio-track-info {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.radio-track-name {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.radio-announcement {
  display: block;
  font-size: 12px;
  color: var(--accent);
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.radio-player-detail {
  padding: 8px 14px 12px;
  border-top: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.radio-volume {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-tertiary);
}

.radio-volume-slider {
  flex: 1;
  height: 4px;
  appearance: none;
  background: var(--border);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.radio-volume-slider::-webkit-slider-thumb {
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
}

.radio-period-label {
  font-size: 11px;
  color: var(--text-tertiary);
  text-align: center;
}

/* Mobile: compact circular button */
@media (max-width: 768px) {
  .radio-player {
    bottom: 16px;
    right: 16px;
    min-width: unset;
    max-width: unset;
  }

  .radio-player:not(.radio-player--expanded) {
    border-radius: 50%;
    width: 48px;
    height: 48px;
  }

  .radio-player:not(.radio-player--expanded) .radio-player-bar {
    justify-content: center;
    padding: 8px;
  }

  .radio-player:not(.radio-player--expanded) .radio-track-info,
  .radio-player:not(.radio-player--expanded) .radio-period-icon {
    display: none;
  }

  .radio-player--expanded {
    min-width: 260px;
    border-radius: var(--radius);
  }
}
```

- [ ] **Step 3: Add RadioPlayer to MapPanel**

In `src/components/map-panel.tsx`, add import at top:
```typescript
import { RadioPlayer } from "@/components/radio-player";
```

In the JSX return (inside the component, right before the closing `</>` around line 643), add:
```tsx
<RadioPlayer />
```

- [ ] **Step 4: Commit**

```bash
git add src/components/radio-player.tsx src/app/globals.css src/components/map-panel.tsx
git commit -m "feat(radio): add RadioPlayer component with playback, announcements, and responsive UI"
```

---

## Task 7: Environment variables + test run

**Files:**
- Modify: `.env`

- [ ] **Step 1: Add env vars to .env**

Append to `.env`:
```
DEEPSEEK_API_KEY=your-key-here
ELEVENLABS_API_KEY=your-key-here
ELEVENLABS_VOICE_ID=your-voice-id-here
```

- [ ] **Step 2: Add sample music for testing**

Download 1-2 CC0 MP3 files and place in `public/radio/daytime/`. Then run the manifest builder:

```bash
npm run build:radio
```

Verify `public/radio/manifest.json` shows the tracks.

- [ ] **Step 3: Run dev server and test**

```bash
npm run dev
```

Test checklist:
1. Page loads with correct `data-period` attribute on `<html>`
2. Map tile filter matches current time period
3. Radio player visible in bottom-right corner
4. Click play → music starts from playlist
5. Volume slider works
6. Expand/collapse works
7. Mobile view shows compact circle button
8. If API keys set: after N tracks, announcement plays

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "feat(radio): complete MVP — env setup and integration test"
```
