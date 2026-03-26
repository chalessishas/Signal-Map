// src/app/radio-dashboard/page.tsx
import { PERIOD_CONFIG, type Period, getCurrentPeriod } from "@/lib/radio";
import manifest from "../../../public/radio/manifest.json";

export const dynamic = "force-dynamic";

type Track = { title: string; artist: string; file: string; duration: number };
type Manifest = Record<Period, Track[]>;

const PERIOD_ORDER: Period[] = ["morning", "daytime", "evening", "night"];
const PERIOD_HOURS: Record<Period, string> = {
  morning: "7:00 – 9:00 AM",
  daytime: "9:00 AM – 5:00 PM",
  evening: "5:00 – 9:00 PM",
  night: "9:00 PM – 7:00 AM",
};
const PERIOD_EMOJI: Record<Period, string> = {
  morning: "\u2600\uFE0F",
  daytime: "\u{1F324}\uFE0F",
  evening: "\u{1F305}",
  night: "\u{1F319}",
};

export default async function RadioDashboard() {
  const currentPeriod = getCurrentPeriod();
  const m = manifest as Manifest;

  // Generate a sample announcement for each period
  const previews: Record<string, string> = {};
  for (const period of PERIOD_ORDER) {
    try {
      const res = await fetch(
        `${process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "http://localhost:3000"}/api/radio/announce?period=${period}`,
        { cache: "no-store" },
      );
      const data = await res.json();
      previews[period] = data.text ?? "(failed to generate)";
    } catch {
      previews[period] = "(unavailable)";
    }
  }

  return (
    <div className="rd-shell">
      <header className="rd-header">
        <h1>Campus Radio Dashboard</h1>
        <p className="rd-sub">
          Current period: <strong>{PERIOD_EMOJI[currentPeriod]} {PERIOD_CONFIG[currentPeriod].label}</strong>
          {" "}({PERIOD_HOURS[currentPeriod]} ET)
        </p>
      </header>

      {/* System Prompt / Persona */}
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

      {/* Per-period sections */}
      {PERIOD_ORDER.map((period) => {
        const config = PERIOD_CONFIG[period];
        const tracks = m[period] ?? [];
        const isActive = period === currentPeriod;

        return (
          <section key={period} className={`rd-section rd-period-section${isActive ? " rd-period-section--active" : ""}`}>
            <div className="rd-period-header">
              <h2>
                {PERIOD_EMOJI[period]} {config.label}
                {isActive && <span className="rd-live-badge">LIVE</span>}
              </h2>
              <span className="rd-period-hours">{PERIOD_HOURS[period]} ET</span>
            </div>

            <div className="rd-period-meta">
              <span>Announce every <strong>{config.announcementInterval}</strong> tracks</span>
              <span>Tone: <em>{config.emotion}</em></span>
              <span>{tracks.length} tracks</span>
            </div>

            {/* Playlist */}
            <div className="rd-tracklist">
              <div className="rd-tracklist-header">
                <span className="rd-th-num">#</span>
                <span className="rd-th-title">Title</span>
                <span className="rd-th-artist">Artist</span>
              </div>
              {tracks.map((t, i) => (
                <div key={t.file} className="rd-track-row">
                  <span className="rd-track-num">{i + 1}</span>
                  <span className="rd-track-title">{t.title}</span>
                  <span className="rd-track-artist">{t.artist}</span>
                </div>
              ))}
            </div>

            {/* Announcement Preview */}
            <div className="rd-announce-preview">
              <div className="rd-announce-label">Sample Announcement</div>
              <blockquote className="rd-announce-text">
                &ldquo;{previews[period]}&rdquo;
              </blockquote>
            </div>
          </section>
        );
      })}

      <footer className="rd-footer">
        All music is CC0 (Public Domain). Sources: Komiku, TAD, omfgdude, SpringySpringo via OpenGameArt.
      </footer>
    </div>
  );
}
