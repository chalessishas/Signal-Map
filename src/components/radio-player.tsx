// src/components/radio-player.tsx
"use client";

import { useEffect, useRef, useState } from "react";
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
  const [playlist, setPlaylist] = useState<Track[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<Track[]>([]);
  const queueIndexRef = useRef(0);
  const tracksSinceAnnounceRef = useRef(0);
  const playNextRef = useRef<() => void>(() => {});
  const playNextTrackRef = useRef<() => void>(() => {});

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

  async function fetchPlaylist(p: Period) {
    try {
      const res = await fetch(`/api/radio/playlist?period=${p}`);
      const data = await res.json();
      queueRef.current = data.tracks ?? [];
      queueIndexRef.current = 0;
      setPlaylist(data.tracks ?? []);
    } catch {
      queueRef.current = [];
      setPlaylist([]);
    }
  }

  // Keep refs in sync with current period so onended handlers never go stale
  useEffect(() => {
    playNextRef.current = async () => {
      const audio = audioRef.current;
      if (!audio) return;

      const config = PERIOD_CONFIG[period];

      if (tracksSinceAnnounceRef.current >= config.announcementInterval) {
        tracksSinceAnnounceRef.current = 0;
        try {
          const res = await fetch(`/api/radio/announce?period=${period}`);
          const data = await res.json();
          if (data.audio) {
            setAnnouncementText(data.text);
            audio.src = `data:audio/wav;base64,${data.audio}`;
            audio.onended = () => {
              setAnnouncementText(null);
              playNextTrackRef.current();
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

      playNextTrackRef.current();
    };

    playNextTrackRef.current = () => {
      const audio = audioRef.current;
      if (!audio || queueRef.current.length === 0) return;

      if (queueIndexRef.current >= queueRef.current.length) {
        queueIndexRef.current = 0;
      }

      const track = queueRef.current[queueIndexRef.current];
      queueIndexRef.current++;
      tracksSinceAnnounceRef.current++;

      setCurrentTrack(track);
      audio.src = track.file;
      audio.onended = () => playNextRef.current();
      audio.play().catch(() => setIsPlaying(false));
    };
  }, [period]);

  async function handleTogglePlay() {
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
        playNextTrackRef.current();
      } else {
        audio.play().catch(() => {});
      }
      setIsPlaying(true);
    }
  }

  // When period changes, reload playlist after current track ends
  useEffect(() => {
    if (!isPlaying) return;
    const audio = audioRef.current;
    if (!audio) return;

    const originalOnEnded = audio.onended;
    audio.onended = async () => {
      await fetchPlaylist(period);
      playNextTrackRef.current();
    };

    return () => {
      audio.onended = originalOnEnded;
    };
  }, [period, isPlaying]);

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
          {playlist.length > 0 && (
            <div className="radio-playlist">
              <div className="radio-playlist-title">Playlist</div>
              {playlist.map((t, i) => (
                <div
                  key={t.file}
                  className={`radio-playlist-item${currentTrack?.file === t.file ? " radio-playlist-item--active" : ""}`}
                >
                  <span className="radio-playlist-idx">{i + 1}</span>
                  <span className="radio-playlist-track">
                    {t.artist !== "Unknown" ? `${t.artist} — ${t.title}` : t.title}
                  </span>
                  {currentTrack?.file === t.file && (
                    <span className="radio-playlist-now">NOW</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
