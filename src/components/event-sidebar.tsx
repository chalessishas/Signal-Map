"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { format } from "date-fns";
import type { BuildingSummary } from "@/lib/types";

type EventItem = {
  id: string;
  title: string;
  startTime: string;
  endTime: string | null;
  locationText: string | null;
  organizer: string | null;
  category: string | null;
  isCLE: boolean;
  buildingId: string | null;
};

type EventSidebarProps = {
  buildings: BuildingSummary[];
  categories: string[];
  activeBuildings: number;
  totalEvents: number;
};

const CATEGORY_ICONS: Record<string, string> = {
  Academic: "\u{1F393}",
  Social: "\u{1F389}",
  Arts: "\u{1F3A8}",
  Performance: "\u{1F3AD}",
  Fitness: "\u{1F3CB}",
  Career: "\u{1F4BC}",
  Athletics: "\u{26BD}",
  Library: "\u{1F4DA}",
};

function getCategoryIcon(cat: string): string {
  return CATEGORY_ICONS[cat] ?? "\u{1F4CC}";
}

const HEAT_COLORS: Record<number, string> = {
  0: "var(--heat-0)",
  1: "var(--heat-1)",
  2: "var(--heat-2)",
  3: "var(--heat-3)",
  4: "var(--heat-4)",
};

export function EventSidebar({ buildings, categories, activeBuildings, totalEvents }: EventSidebarProps) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set());
  const [mobileOpen, setMobileOpen] = useState(false);

  // Build a buildingId -> building lookup
  const buildingMap = useMemo(() => {
    const map = new Map<string, BuildingSummary>();
    for (const b of buildings) map.set(b.id, b);
    return map;
  }, [buildings]);

  // Fetch all events on mount
  useEffect(() => {
    const controller = new AbortController();
    const from = new Date();
    const to = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    fetch(`/api/events?from=${from.toISOString()}&to=${to.toISOString()}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        setEvents(data.items ?? []);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoading(false);
      });

    return () => controller.abort();
  }, []);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events) {
      if (e.category) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
    }
    return counts;
  }, [events]);

  // Filtered + searched events
  const filteredEvents = useMemo(() => {
    let result = events;
    if (activeCategories.size > 0) {
      result = result.filter((e) => e.category && activeCategories.has(e.category));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((e) => {
        const building = e.buildingId ? buildingMap.get(e.buildingId) : null;
        return (
          e.title.toLowerCase().includes(q) ||
          (building?.name.toLowerCase().includes(q) ?? false) ||
          (e.locationText?.toLowerCase().includes(q) ?? false)
        );
      });
    }
    return result;
  }, [events, activeCategories, search, buildingMap]);

  const toggleCategory = useCallback((cat: string) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const handleEventClick = useCallback(
    (buildingId: string) => {
      window.dispatchEvent(
        new CustomEvent("signalmap:select-building", { detail: { buildingId } })
      );
      setMobileOpen(false);
    },
    []
  );

  const getBuildingHeatLevel = useCallback(
    (buildingId: string | null): number => {
      if (!buildingId) return 0;
      return buildingMap.get(buildingId)?.heatLevel ?? 0;
    },
    [buildingMap]
  );

  return (
    <>
      {/* Mobile toggle button */}
      <button
        type="button"
        className="event-sidebar-toggle"
        onClick={() => setMobileOpen((o) => !o)}
        aria-label="Toggle event sidebar"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {mobileOpen ? (
            <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
          ) : (
            <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
          )}
        </svg>
      </button>

      <aside className={`event-sidebar${mobileOpen ? " event-sidebar--open" : ""}`}>
        {/* Brand */}
        <div className="event-sidebar-header">
          <div className="brand-row">
            <div className="brand-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </div>
            <h1>SignalMap</h1>
          </div>
          <p className="subtle">UNC Chapel Hill</p>
          <div className="sidebar-stats">
            <div className="sidebar-stat">
              <strong>{activeBuildings}</strong>
              <span>Active</span>
            </div>
            <div className="sidebar-stat">
              <strong>{totalEvents}</strong>
              <span>Events</span>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="event-sidebar-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="event-sidebar-search-input"
          />
          {search && (
            <button
              type="button"
              className="event-sidebar-search-clear"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              &times;
            </button>
          )}
        </div>

        {/* Categories */}
        <div className="event-sidebar-categories">
          <h2 className="event-sidebar-section-title">Categories</h2>
          <div className="event-sidebar-category-list">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`event-sidebar-category${activeCategories.has(cat) ? " event-sidebar-category--active" : ""}`}
                onClick={() => toggleCategory(cat)}
              >
                <span className="event-sidebar-category-icon">{getCategoryIcon(cat)}</span>
                <span className="event-sidebar-category-name">{cat}</span>
                <span className="event-sidebar-category-count">{categoryCounts.get(cat) ?? 0}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Events */}
        <div className="event-sidebar-events">
          <h2 className="event-sidebar-section-title">
            Events
            <span className="event-sidebar-section-count">{filteredEvents.length}</span>
          </h2>

          {loading ? (
            <p className="subtle" style={{ padding: "16px 0", textAlign: "center" }}>
              Loading events...
            </p>
          ) : filteredEvents.length === 0 ? (
            <p className="subtle" style={{ padding: "16px 0", textAlign: "center" }}>
              No events found
            </p>
          ) : (
            <div className="event-sidebar-list">
              {filteredEvents.map((event) => {
                const building = event.buildingId ? buildingMap.get(event.buildingId) : null;
                const heatLevel = getBuildingHeatLevel(event.buildingId);
                const now = new Date();
                const start = new Date(event.startTime);
                const end = event.endTime ? new Date(event.endTime) : null;
                const isLive = start <= now && (!end || end >= now);

                return (
                  <button
                    key={event.id}
                    type="button"
                    className={`event-sidebar-card${isLive ? " event-sidebar-card--live" : ""}`}
                    onClick={() => event.buildingId && handleEventClick(event.buildingId)}
                    disabled={!event.buildingId}
                  >
                    <div className="event-sidebar-card-top">
                      <span
                        className="event-sidebar-card-dot"
                        style={{ background: isLive ? "var(--heat-4)" : HEAT_COLORS[heatLevel] }}
                      />
                      <span className="event-sidebar-card-title">{event.title}</span>
                      {event.isCLE && <span className="cle-badge-inline">CLE</span>}
                    </div>
                    <div className="event-sidebar-card-meta">
                      {building && <span className="event-sidebar-card-building">{building.name}</span>}
                      <span className="event-sidebar-card-time">
                        {isLive ? "Now" : format(start, "MMM d, h:mm a")}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
