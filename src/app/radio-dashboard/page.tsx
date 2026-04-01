// src/app/radio-dashboard/page.tsx
import {
  PERIOD_CONFIG,
  type Period,
  getCurrentPeriod,
  generateAnnouncementText,
} from "@/lib/radio";
import { prisma } from "@/lib/prisma";
import manifest from "../../../public/radio/manifest.json";
import { RadioPlayer } from "@/components/radio-player";

export const dynamic = "force-dynamic";

type Track = { title: string; artist: string; file: string; duration: number };
type Manifest = Record<Period, Track[]>;

const PERIOD_ORDER: Period[] = ["morning", "daytime", "evening", "night"];
const PERIOD_HOURS: Record<Period, { start: string; end: string; hours: number }> = {
  morning: { start: "7:00 AM", end: "9:00 AM", hours: 2 },
  daytime: { start: "9:00 AM", end: "5:00 PM", hours: 8 },
  evening: { start: "5:00 PM", end: "9:00 PM", hours: 4 },
  night:   { start: "9:00 PM", end: "7:00 AM", hours: 10 },
};
const PERIOD_EMOJI: Record<Period, string> = {
  morning: "\u2600\uFE0F",
  daytime: "\u{1F324}\uFE0F",
  evening: "\u{1F305}",
  night: "\u{1F319}",
};
const PERIOD_COLORS: Record<Period, string> = {
  morning: "#f59f00",
  daytime: "#339af0",
  evening: "#e8590c",
  night: "#5c3d99",
};

/** Build a flat timeline of items (track / announce) for one period */
function buildPeriodTimeline(tracks: Track[], announcementInterval: number) {
  const items: { type: "track" | "announce"; label: string; artist?: string }[] = [];
  let sinceAnnounce = 0;
  for (const t of tracks) {
    sinceAnnounce++;
    items.push({ type: "track", label: t.title, artist: t.artist });
    if (sinceAnnounce >= announcementInterval) {
      items.push({ type: "announce", label: "DJ Announcement" });
      sinceAnnounce = 0;
    }
  }
  return items;
}

export default async function RadioDashboard() {
  const currentPeriod = getCurrentPeriod();
  const m = manifest as Manifest;

  // Generate announcement previews by calling the function directly (no HTTP self-fetch)
  const previews: Record<string, string> = {};
  for (const period of PERIOD_ORDER) {
    try {
      const now = new Date();
      const threeHoursLater = new Date(now.getTime() + 3 * 60 * 60 * 1000);
      let eventsDescription = "";
      try {
        const events = await prisma.event.findMany({
          where: { status: "ACTIVE", startTime: { gte: now, lte: threeHoursLater } },
          orderBy: { startTime: "asc" },
          take: 3,
          include: { building: { select: { name: true } } },
        });
        if (events.length > 0) {
          eventsDescription = events
            .map((e) => {
              const loc = e.building?.name ?? "campus";
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
      } catch { /* skip events fetch failure */ }
      previews[period] = await generateAnnouncementText(period as Period, eventsDescription);
    } catch {
      previews[period] = "(unavailable)";
    }
  }

  // Build full-day timeline
  const totalHours = 24;
  const dayTimeline = PERIOD_ORDER.map((period) => {
    const config = PERIOD_CONFIG[period];
    const tracks = m[period] ?? [];
    const hours = PERIOD_HOURS[period];
    const widthPercent = (hours.hours / totalHours) * 100;
    const items = buildPeriodTimeline(tracks, config.announcementInterval);
    return { period, config, tracks, hours, widthPercent, items };
  });

  return (
    <div className="rd-shell">
      <header className="rd-header">
        <h1>Campus Radio Dashboard</h1>
        <p className="rd-sub">
          Current period: <strong>{PERIOD_EMOJI[currentPeriod]} {PERIOD_CONFIG[currentPeriod].label}</strong>
          {" "}({PERIOD_HOURS[currentPeriod].start} – {PERIOD_HOURS[currentPeriod].end} ET)
        </p>
      </header>

      {/* Live Player */}
      <section className="rd-section rd-player-section">
        <h2>Live Player</h2>
        <RadioPlayer />
      </section>

      {/* Full-Day Timeline */}
      <section className="rd-section">
        <h2>Daily Program Schedule</h2>
        <p className="rd-timeline-subtitle">24-hour broadcast cycle — tracks loop within each period, DJ announcements inserted at intervals</p>

        {/* Visual bar */}
        <div className="rd-timeline-bar">
          {dayTimeline.map(({ period, hours, widthPercent }) => (
            <div
              key={period}
              className={`rd-timeline-segment${period === currentPeriod ? " rd-timeline-segment--active" : ""}`}
              style={{ width: `${widthPercent}%`, backgroundColor: PERIOD_COLORS[period] }}
            >
              <span className="rd-timeline-segment-label">
                {PERIOD_EMOJI[period]} {hours.start}
              </span>
            </div>
          ))}
        </div>

        {/* Detailed schedule per period */}
        <div className="rd-schedule-grid">
          {dayTimeline.map(({ period, config, tracks, hours, items }) => (
            <div
              key={period}
              className={`rd-schedule-block${period === currentPeriod ? " rd-schedule-block--active" : ""}`}
            >
              <div className="rd-schedule-block-header" style={{ borderLeftColor: PERIOD_COLORS[period] }}>
                <div className="rd-schedule-time">{hours.start} – {hours.end}</div>
                <div className="rd-schedule-period">
                  {PERIOD_EMOJI[period]} {config.label}
                  {period === currentPeriod && <span className="rd-live-badge">LIVE</span>}
                </div>
                <div className="rd-schedule-meta">
                  {tracks.length} tracks · announce every {config.announcementInterval} · {config.emotion}
                </div>
              </div>

              <div className="rd-schedule-items">
                {items.map((item, i) => (
                  <div key={i} className={`rd-schedule-item rd-schedule-item--${item.type}`}>
                    {item.type === "announce" ? (
                      <span className="rd-schedule-announce-chip">🎙 DJ</span>
                    ) : (
                      <>
                        <span className="rd-schedule-item-num">{
                          items.slice(0, i + 1).filter(x => x.type === "track").length
                        }</span>
                        <span className="rd-schedule-item-title">{item.label}</span>
                        <span className="rd-schedule-item-artist">{item.artist}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* DJ Persona */}
      <section className="rd-section">
        <h2>DJ Persona</h2>
        <div className="rd-persona-card">
          <p className="rd-persona-line"><strong>Role:</strong> UNC Chapel Hill campus radio host</p>
          <p className="rd-persona-line"><strong>Language:</strong> English</p>
          <p className="rd-persona-line"><strong>Max length:</strong> 60 words per announcement</p>
          <p className="rd-persona-line"><strong>Model:</strong> DeepSeek Chat (temperature 0.9)</p>
          <p className="rd-persona-line"><strong>Voice:</strong> DashScope qwen3-tts-flash &middot; Ethan</p>
          <div className="rd-persona-tones">
            {PERIOD_ORDER.map((p) => (
              <div key={p} className={`rd-tone-chip${p === currentPeriod ? " rd-tone-chip--active" : ""}`}>
                <span>{PERIOD_EMOJI[p]}</span>
                <span className="rd-tone-label">{PERIOD_CONFIG[p].label}</span>
                <span className="rd-tone-value">{PERIOD_CONFIG[p].emotion}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sample Announcements */}
      <section className="rd-section">
        <h2>Sample Announcements</h2>
        <div className="rd-announce-grid">
          {PERIOD_ORDER.map((period) => (
            <div key={period} className="rd-announce-card">
              <div className="rd-announce-card-header">
                {PERIOD_EMOJI[period]} {PERIOD_CONFIG[period].label}
              </div>
              <blockquote className="rd-announce-text">
                &ldquo;{previews[period]}&rdquo;
              </blockquote>
            </div>
          ))}
        </div>
      </section>

      <footer className="rd-footer">
        All music is CC0 (Public Domain). Sources: Komiku, TAD, omfgdude, SpringySpringo via OpenGameArt.
      </footer>
    </div>
  );
}
