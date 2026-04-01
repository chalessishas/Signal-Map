// src/components/newscast-player.tsx
"use client";

import { useEffect, useRef, useState } from "react";

type NewsSource = { title: string; url: string; source: string };
type Episode = {
  id: string;
  date: string;
  title: string;
  script: string;
  hasAudio: boolean;
  audioBase64: string | null;
  sources: NewsSource[];
  weather: { temp: number; condition: string; high: number; low: number } | null;
};

export function NewscastPlayer() {
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchLatest();
    return () => { audioRef.current?.pause(); };
  }, []);

  async function fetchLatest() {
    try {
      const res = await fetch("/api/newscast?limit=1");
      const data = await res.json();
      if (data.episodes?.[0]) {
        setEpisode(data.episodes[0]);
      }
    } catch { /* no episode yet */ }
  }

  function handlePlayPause() {
    if (!episode?.audioBase64) return;

    if (!audioRef.current) {
      audioRef.current = new Audio(`data:audio/wav;base64,${episode.audioBase64}`);
      audioRef.current.onended = () => setIsPlaying(false);
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
    }
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cron/newscast?token=" + encodeURIComponent(
        // Try to get admin token from a hidden field or prompt
        (document.querySelector<HTMLMetaElement>("meta[name=admin-token]")?.content ?? "")
      ));
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      await fetchLatest();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  const dateLabel = episode
    ? new Date(episode.date).toLocaleDateString("en-US", {
        timeZone: "UTC",
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className={`newscast${expanded ? " newscast--expanded" : ""}`}>
      <div className="newscast-bar" onClick={() => episode && setExpanded((e) => !e)}>
        <span className="newscast-icon">📻</span>

        {episode?.hasAudio && (
          <button
            type="button"
            className="newscast-play-btn"
            onClick={(e) => { e.stopPropagation(); handlePlayPause(); }}
            aria-label={isPlaying ? "Pause briefing" : "Play briefing"}
          >
            {isPlaying ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
            )}
          </button>
        )}

        <div className="newscast-info">
          {episode ? (
            <>
              <span className="newscast-title">Morning Brief</span>
              <span className="newscast-date">{dateLabel}</span>
            </>
          ) : (
            <span className="newscast-title newscast-title--empty">No briefing yet</span>
          )}
        </div>
      </div>

      {expanded && episode && (
        <div className="newscast-detail">
          {/* Weather */}
          {episode.weather && (
            <div className="newscast-weather">
              🌡 {episode.weather.temp}°F · {episode.weather.condition} · H {episode.weather.high}° L {episode.weather.low}°
            </div>
          )}

          {/* Script */}
          <div className="newscast-script">
            {episode.script.split("\n").filter(Boolean).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          {/* Sources */}
          {episode.sources.length > 0 && (
            <div className="newscast-sources">
              <div className="newscast-sources-label">Sources</div>
              {episode.sources.map((s, i) => (
                <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="newscast-source-link">
                  <span className="newscast-source-name">{s.source}</span>
                  <span className="newscast-source-title">{s.title}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <div className="newscast-error">{error}</div>}
    </div>
  );
}
