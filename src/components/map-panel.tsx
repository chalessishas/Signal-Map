"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import type { BuildingSummary, HeatLevel } from "@/lib/types";
import { SearchPanel } from "@/components/search-panel";
import { ThemeToggle } from "@/components/theme-toggle";

/* ─── Types ─── */

type EventItem = {
  id: string;
  title: string;
  startTime: string;
  endTime: string | null;
  locationText: string | null;
  organizer: string | null;
  category: string | null;
  isCLE: boolean;
};

type EventResponse = { items: EventItem[] };

type PanelState = {
  building: BuildingSummary | null;
  now: EventItem[];
  upcoming: EventItem[];
  loading: boolean;
};

type GeoJSONFeature = {
  type: "Feature";
  properties: { n: string; c: [number, number] };
  geometry: { type: "Polygon"; coordinates: number[][][] };
};

type GeoJSONCollection = {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
};

/* ─── Constants ─── */

const UNC_CENTER: [number, number] = [35.9108, -79.0472];

// Much larger star sizes for visibility
const STAR_RADIUS: Record<HeatLevel, number> = {
  0: 0,
  1: 6,
  2: 9,
  3: 12,
  4: 16,
};

// Vivid star colors with strong glows
const STAR_COLORS: Record<HeatLevel, { fill: string; glow: string; outer: string; glowSize: number }> = {
  0: { fill: "#3a3f50", glow: "rgba(58,63,80,0)", outer: "rgba(58,63,80,0)", glowSize: 0 },
  1: { fill: "#d4d4cc", glow: "rgba(212,212,204,0.5)", outer: "rgba(212,212,204,0.15)", glowSize: 18 },
  2: { fill: "#ffd666", glow: "rgba(255,214,102,0.65)", outer: "rgba(255,214,102,0.2)", glowSize: 26 },
  3: { fill: "#ff9f43", glow: "rgba(255,159,67,0.7)", outer: "rgba(255,159,67,0.25)", glowSize: 34 },
  4: { fill: "#ff6b6b", glow: "rgba(255,107,107,0.8)", outer: "rgba(255,107,107,0.3)", glowSize: 44 },
};

const CLE_COLOR = "#4dabf7";

// Ghost building styles — slightly more visible
const GHOST_STYLE = { fill: "#ffffff", fillOp: 0.04, stroke: "rgba(255,255,255,0.08)", weight: 0.6 };
const GHOST_ACTIVE_STYLE = { fill: "#ffffff", fillOp: 0.08, stroke: "rgba(255,255,255,0.18)", weight: 1 };

// Constellation link distance
const CONSTELLATION_LINK_DIST = 400;

/* ─── Category icon mapping ─── */

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

/* ─── Helpers ─── */

function distM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ─── Star Field Canvas (ambient background particles) ─── */

function StarFieldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const stars: { x: number; y: number; r: number; speed: number; phase: number; brightness: number }[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Generate ambient stars
    for (let i = 0; i < 180; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.2 + 0.3,
        speed: Math.random() * 0.4 + 0.1,
        phase: Math.random() * Math.PI * 2,
        brightness: Math.random() * 0.4 + 0.1,
      });
    }

    const draw = (t: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const s of stars) {
        const twinkle = Math.sin(t * 0.001 * s.speed + s.phase) * 0.5 + 0.5;
        const alpha = s.brightness * (0.4 + twinkle * 0.6);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 210, 230, ${alpha})`;
        ctx.fill();

        // Subtle glow for brighter stars
        if (s.r > 0.8) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(180, 200, 240, ${alpha * 0.08})`;
          ctx.fill();
        }
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        opacity: 0.7,
      }}
    />
  );
}

/* ─── Component ─── */

type MapPanelProps = {
  initialBuildings: BuildingSummary[];
  categories: string[];
};

export function MapPanel({ initialBuildings, categories }: MapPanelProps) {
  const mapRef = useRef<unknown>(null);
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [state, setState] = useState<PanelState>({
    building: null,
    now: [],
    upcoming: [],
    loading: false,
  });

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [filterExpanded, setFilterExpanded] = useState(false);

  // Force dark theme on mount for constellation mode
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("signalmap-theme", "dark");
  }, []);

  // Filtered events
  const filteredNow = useMemo(() => {
    if (!activeCategory) return state.now;
    return state.now.filter((e) => e.category === activeCategory);
  }, [state.now, activeCategory]);

  const filteredUpcoming = useMemo(() => {
    if (!activeCategory) return state.upcoming;
    return state.upcoming.filter((e) => e.category === activeCategory);
  }, [state.upcoming, activeCategory]);

  const selectBuilding = useCallback(async (building: BuildingSummary, category?: string | null) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((prev) => ({ ...prev, building, loading: true }));

    const from = new Date();
    const to = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const query = new URLSearchParams({
      buildingId: building.id,
      from: from.toISOString(),
      to: to.toISOString(),
    });
    if (category) query.set("category", category);

    try {
      const response = await fetch(`/api/events?${query.toString()}`, { signal: controller.signal });
      if (!response.ok) {
        setState({ building, now: [], upcoming: [], loading: false });
        return;
      }

      const payload = (await response.json()) as EventResponse;
      const nowTime = new Date();
      const now: EventItem[] = [];
      const upcoming: EventItem[] = [];

      for (const event of payload.items) {
        const start = new Date(event.startTime);
        const end = event.endTime ? new Date(event.endTime) : null;
        if (start <= nowTime && (!end || end >= nowTime)) {
          now.push(event);
        } else if (start > nowTime) {
          upcoming.push(event);
        }
      }

      setState({ building, now, upcoming, loading: false });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setState({ building, now: [], upcoming: [], loading: false });
    }
  }, []);

  // Re-fetch when category changes
  useEffect(() => {
    if (state.building) void selectBuilding(state.building, activeCategory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory]);

  const handleCategoryToggle = useCallback((cat: string) => {
    setActiveCategory((prev) => (prev === cat ? null : cat));
  }, []);

  const closeOverlay = useCallback(() => {
    setState({ building: null, now: [], upcoming: [], loading: false });
    if (mapRef.current) {
      (mapRef.current as { flyTo: (c: [number, number], z: number, o: Record<string, number>) => void })
        .flyTo(UNC_CENTER, 16, { duration: 0.6 });
    }
  }, []);

  const handleSearchSelect = useCallback((building: BuildingSummary) => {
    if (mapRef.current) {
      const offsetLat = building.lat - 0.0012;
      (mapRef.current as { flyTo: (c: { lat: number; lng: number }, z: number, o: Record<string, number>) => void })
        .flyTo({ lat: offsetLat, lng: building.lng }, 18, { duration: 0.8 });
    }
    void selectBuilding(building, activeCategory);
  }, [selectBuilding, activeCategory]);

  // Keyboard: Escape to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && state.building) closeOverlay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.building, closeOverlay]);

  // ── Initialize map with constellation overlay ──
  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) return;
    let cancelled = false;
    let localMap: { remove: () => void } | null = null;

    import("leaflet").then(async (L) => {
      if (cancelled || !mapNodeRef.current) return;

      const map = L.map(mapNodeRef.current, {
        center: UNC_CENTER,
        zoom: 16,
        zoomControl: false,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Dark tile layer — using dark_nolabels for cleaner look
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      }).addTo(map);

      // Build building index
      const buildingIndex = new Map<number, BuildingSummary>();
      const activeBuildings: BuildingSummary[] = [];

      let geojson: GeoJSONCollection | null = null;
      try {
        const res = await fetch("/buildings.geojson");
        if (res.ok) geojson = (await res.json()) as GeoJSONCollection;
      } catch { /* ignore */ }

      if (!geojson) {
        mapRef.current = map;
        return;
      }

      // Match DB buildings to OSM polygons
      const matchedBuildingIds = new Set<string>();
      for (let i = 0; i < geojson.features.length; i++) {
        const osmName = geojson.features[i].properties.n;
        if (!osmName) continue;
        const osmLower = osmName.toLowerCase();

        for (const building of initialBuildings) {
          if (matchedBuildingIds.has(building.id)) continue;
          const allNames = [building.name, ...building.aliases];
          const matched = allNames.some((alias) => {
            const aLower = alias.toLowerCase();
            return osmLower.includes(aLower) || aLower.includes(osmLower);
          });
          if (matched) {
            buildingIndex.set(i, building);
            matchedBuildingIds.add(building.id);
            break;
          }
        }
      }

      // Pass 2: match remaining by distance
      const unmatchedBuildings = initialBuildings.filter((b) => !matchedBuildingIds.has(b.id));
      for (const building of unmatchedBuildings) {
        let bestIdx = -1;
        let bestDist = 80;
        for (let i = 0; i < geojson.features.length; i++) {
          if (buildingIndex.has(i)) continue;
          const feat = geojson.features[i];
          const [clat, clng] = feat.properties.c;
          const d = distM(building.lat, building.lng, clat, clng);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }
        if (bestIdx >= 0) {
          buildingIndex.set(bestIdx, building);
          matchedBuildingIds.add(building.id);
        }
      }

      // ── Layer 1: Ghost building polygons ──
      L.geoJSON(geojson as GeoJSON.GeoJsonObject, {
        style: (feature) => {
          if (!feature) return {};
          const idx = geojson!.features.indexOf(feature as GeoJSONFeature);
          const matched = buildingIndex.get(idx);

          if (matched && matched.heatLevel > 0) {
            return {
              fillColor: GHOST_ACTIVE_STYLE.fill,
              fillOpacity: GHOST_ACTIVE_STYLE.fillOp,
              color: GHOST_ACTIVE_STYLE.stroke,
              weight: GHOST_ACTIVE_STYLE.weight,
              className: "ghost-poly ghost-active",
            };
          }

          return {
            fillColor: GHOST_STYLE.fill,
            fillOpacity: GHOST_STYLE.fillOp,
            color: GHOST_STYLE.stroke,
            weight: GHOST_STYLE.weight,
            className: "ghost-poly",
          };
        },
        onEachFeature: (_feature, layer) => {
          (layer as L.Path).options.interactive = false;
        },
      }).addTo(map);

      // ── Collect active buildings ──
      for (const building of initialBuildings) {
        if (building.heatLevel > 0) {
          activeBuildings.push(building);
        }
      }

      // ── Layer 2: Constellation lines (bright, animated, visible!) ──
      const drawnPairs = new Set<string>();
      for (let i = 0; i < activeBuildings.length; i++) {
        for (let j = i + 1; j < activeBuildings.length; j++) {
          const a = activeBuildings[i];
          const b = activeBuildings[j];
          const d = distM(a.lat, a.lng, b.lat, b.lng);
          if (d < CONSTELLATION_LINK_DIST) {
            const pairKey = [a.id, b.id].sort().join("-");
            if (drawnPairs.has(pairKey)) continue;
            drawnPairs.add(pairKey);

            const heatSum = a.heatLevel + b.heatLevel;
            const opacity = Math.min(0.2 + heatSum * 0.08, 0.65);
            const weight = Math.min(0.8 + heatSum * 0.2, 2.0);

            // Glow line (thicker, more transparent)
            L.polyline(
              [[a.lat, a.lng], [b.lat, b.lng]],
              {
                color: "#7c8cf5",
                weight: weight + 4,
                opacity: opacity * 0.2,
                className: "constellation-glow",
                interactive: false,
              }
            ).addTo(map);

            // Core line
            L.polyline(
              [[a.lat, a.lng], [b.lat, b.lng]],
              {
                color: "rgba(180, 195, 255, 0.9)",
                weight,
                opacity,
                dashArray: "6 4",
                className: "constellation-line",
                interactive: false,
              }
            ).addTo(map);
          }
        }
      }

      // ── Layer 3: Star markers (multi-layer glow system) ──
      for (const building of activeBuildings) {
        const hl = building.heatLevel as HeatLevel;
        const star = STAR_COLORS[hl];
        const radius = STAR_RADIUS[hl];
        const isCLE = building.cleCount > 0;

        // Layer A: Wide outer glow (nebula effect)
        if (star.glowSize > 0) {
          L.circleMarker([building.lat, building.lng], {
            radius: star.glowSize,
            fillColor: isCLE ? CLE_COLOR : star.fill,
            fillOpacity: 0.12,
            color: "transparent",
            weight: 0,
            className: `star-nebula star-nebula-${hl}`,
            interactive: false,
          }).addTo(map);
        }

        // Layer B: Middle glow ring
        if (star.glowSize > 0) {
          L.circleMarker([building.lat, building.lng], {
            radius: radius + 8,
            fillColor: isCLE ? CLE_COLOR : star.fill,
            fillOpacity: 0.2,
            color: isCLE ? CLE_COLOR : star.glow,
            weight: 1.5,
            opacity: 0.3,
            className: `star-glow star-glow-${hl}${isCLE ? " star-cle-glow" : ""}`,
            interactive: false,
          }).addTo(map);
        }

        // Layer C: CLE orbit ring
        if (isCLE) {
          L.circleMarker([building.lat, building.lng], {
            radius: radius + 14,
            fillColor: "transparent",
            fillOpacity: 0,
            color: CLE_COLOR,
            weight: 1.5,
            opacity: 0.6,
            dashArray: "4 4",
            className: "star-cle-ring",
            interactive: false,
          }).addTo(map);
        }

        // Layer D: Core star (bright, solid)
        const starMarker = L.circleMarker([building.lat, building.lng], {
          radius,
          fillColor: star.fill,
          fillOpacity: 1,
          color: "#ffffff",
          weight: 1.5,
          opacity: 0.8,
          className: `star-core star-core-${hl}${isCLE ? " star-cle" : ""}`,
        });

        // Tooltip
        const tooltipLines: string[] = [
          `<span class="star-tooltip-name">${building.name}</span>`,
        ];
        if (building.happeningNowCount > 0) {
          tooltipLines.push(`<span class="star-tooltip-live">\u2022 ${building.happeningNowCount} happening now</span>`);
        } else if (building.nextEventStartsAt) {
          const dist = formatDistanceToNow(new Date(building.nextEventStartsAt), { addSuffix: false });
          tooltipLines.push(`<span class="star-tooltip-time">Next in ${dist}</span>`);
        }
        if (building.eventCount > 0) {
          tooltipLines.push(`<span class="star-tooltip-count">${building.eventCount} events</span>`);
        }
        if (isCLE) {
          tooltipLines.push(`<span class="star-tooltip-cle">\u2726 CLE ${building.cleCount}</span>`);
        }

        starMarker.bindTooltip(tooltipLines.join("<br>"), {
          direction: "top",
          offset: [0, -radius - 6],
          className: "star-tooltip",
        });

        // Click → select building
        starMarker.on("click", (e: L.LeafletEvent) => {
          L.DomEvent.stopPropagation(e as unknown as Event);
          const offsetLat = building.lat - 0.0012;
          map.flyTo(L.latLng(offsetLat, building.lng), 18, { duration: 0.8 });
          setState((prev) => ({ ...prev, building, loading: true }));

          const from = new Date();
          const to = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
          const query = new URLSearchParams({
            buildingId: building.id,
            from: from.toISOString(),
            to: to.toISOString(),
          });

          fetch(`/api/events?${query.toString()}`)
            .then((res) => res.json())
            .then((payload: EventResponse) => {
              const nowTime = new Date();
              const now: EventItem[] = [];
              const upcoming: EventItem[] = [];
              for (const event of payload.items) {
                const start = new Date(event.startTime);
                const end = event.endTime ? new Date(event.endTime) : null;
                if (start <= nowTime && (!end || end >= nowTime)) {
                  now.push(event);
                } else if (start > nowTime) {
                  upcoming.push(event);
                }
              }
              setState({ building, now, upcoming, loading: false });
            })
            .catch(() => {
              setState({ building, now: [], upcoming: [], loading: false });
            });
        });

        starMarker.addTo(map);
      }

      // Click map to close
      map.on("click", () => {
        setState({ building: null, now: [], upcoming: [], loading: false });
      });

      localMap = map;
      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      const mapToRemove = mapRef.current ?? localMap;
      if (mapToRemove) {
        (mapToRemove as { remove: () => void }).remove();
        mapRef.current = null;
        localMap = null;
      }
      if (abortRef.current) abortRef.current.abort();
    };
  }, [initialBuildings, selectBuilding, closeOverlay]);

  // Count visible categories for compact display
  const visibleCatCount = 5;
  const mainCats = categories.slice(0, visibleCatCount);
  const extraCats = categories.slice(visibleCatCount);

  return (
    <>
      {/* Ambient star field canvas */}
      <StarFieldCanvas />

      <div ref={mapNodeRef} style={{ position: "absolute", inset: 0, zIndex: 1 }} />

      {/* Vignette overlay for depth */}
      <div className="vignette-overlay" />

      {/* Theme toggle */}
      <ThemeToggle />

      {/* Search */}
      <SearchPanel buildings={initialBuildings} onSelect={handleSearchSelect} />

      {/* Star guide legend — top-left, compact */}
      <div className="star-guide">
        <div className="star-guide-title">Star Guide</div>
        <div className="star-guide-items">
          <div className="star-guide-item">
            <span className="star-guide-dot star-guide-4" />
            <span>Happening Now</span>
          </div>
          <div className="star-guide-item">
            <span className="star-guide-dot star-guide-3" />
            <span>Within 3h</span>
          </div>
          <div className="star-guide-item">
            <span className="star-guide-dot star-guide-2" />
            <span>Within 6h</span>
          </div>
          <div className="star-guide-item">
            <span className="star-guide-dot star-guide-1" />
            <span>Later Today</span>
          </div>
          <div className="star-guide-item">
            <span className="star-guide-dot star-guide-cle" />
            <span>CLE Credit</span>
          </div>
        </div>
      </div>

      {/* Category filter — compact bottom pill with overflow menu */}
      {categories.length > 0 && (
        <div className="filter-bar">
          <button
            type="button"
            className={`filter-pill${activeCategory === null ? " filter-pill--active" : ""}`}
            onClick={() => { setActiveCategory(null); setFilterExpanded(false); }}
          >
            All
          </button>
          {mainCats.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`filter-pill${activeCategory === cat ? " filter-pill--active" : ""}`}
              onClick={() => handleCategoryToggle(cat)}
            >
              <span className="filter-pill-icon">{getCategoryIcon(cat)}</span>
              {cat.length > 16 ? cat.slice(0, 14) + "\u2026" : cat}
            </button>
          ))}
          {extraCats.length > 0 && (
            <button
              type="button"
              className={`filter-pill filter-pill--more${filterExpanded ? " filter-pill--active" : ""}`}
              onClick={() => setFilterExpanded((p) => !p)}
            >
              +{extraCats.length} more
            </button>
          )}
        </div>
      )}

      {/* Expanded categories popup */}
      {filterExpanded && extraCats.length > 0 && (
        <div className="filter-expanded">
          {extraCats.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`filter-pill${activeCategory === cat ? " filter-pill--active" : ""}`}
              onClick={() => { handleCategoryToggle(cat); setFilterExpanded(false); }}
            >
              <span className="filter-pill-icon">{getCategoryIcon(cat)}</span>
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Bottom overlay — event detail panel */}
      <div className="event-overlay-anchor">
        <div className={`event-overlay${state.building ? " open" : ""}`}>
          {state.building && (
            <>
              <div className="overlay-header">
                <h3>{state.building.name}</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="badge badge-campus">
                    {state.building.campus === "NORTH" ? "North" : state.building.campus === "SOUTH" ? "South" : "Campus"}
                  </span>
                  {state.building.cleCount > 0 && (
                    <span className="badge badge-cle">CLE {state.building.cleCount}</span>
                  )}
                  <button type="button" className="overlay-close" onClick={closeOverlay}>&times;</button>
                </div>
              </div>
              {state.building.description && (
                <p className="building-description">{state.building.description}</p>
              )}

              {activeCategory && (
                <div className="overlay-filter-notice">
                  Filtered: <strong>{activeCategory}</strong>
                  <button type="button" className="overlay-filter-clear" onClick={() => setActiveCategory(null)}>
                    Clear
                  </button>
                </div>
              )}

              {state.loading ? (
                <p className="subtle" style={{ padding: "16px 0", textAlign: "center" }}>Loading events...</p>
              ) : (
                <>
                  <div className="overlay-stats">
                    <div className="overlay-stat">
                      <span className="overlay-stat-num">{filteredNow.length}</span>
                      <span className="overlay-stat-label">Now</span>
                    </div>
                    <div className="overlay-stat">
                      <span className="overlay-stat-num">{filteredUpcoming.length}</span>
                      <span className="overlay-stat-label">Upcoming</span>
                    </div>
                    {state.building.nextEventStartsAt && filteredNow.length === 0 && (
                      <div className="overlay-stat overlay-stat--countdown">
                        <span className="overlay-stat-num">
                          {formatDistanceToNow(new Date(state.building.nextEventStartsAt))}
                        </span>
                        <span className="overlay-stat-label">Until Next</span>
                      </div>
                    )}
                  </div>

                  {filteredNow.length > 0 && (
                    <div className="event-section">
                      <h4>Happening Now</h4>
                      <div className="event-list">
                        {filteredNow.map((event) => (
                          <EventCard key={event.id} event={event} live />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="event-section">
                    <h4>Coming Up</h4>
                    <div className="event-list">
                      {filteredUpcoming.length === 0 ? (
                        <p className="subtle">
                          {activeCategory
                            ? `No ${activeCategory} events in the next 3 days`
                            : "No upcoming events in the next 3 days"}
                        </p>
                      ) : (
                        filteredUpcoming.slice(0, 8).map((event) => (
                          <EventCard key={event.id} event={event} />
                        ))
                      )}
                    </div>
                  </div>

                  {filteredUpcoming.length > 8 && (
                    <Link href={`/building/${state.building.id}`} className="view-all-link">
                      View all {filteredUpcoming.length} events &rarr;
                    </Link>
                  )}

                  <Link href={`/building/${state.building.id}`} className="view-all-link">
                    Full details &rarr;
                  </Link>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── EventCard ─── */

function EventCard({ event, live }: { event: EventItem; live?: boolean }) {
  return (
    <article className={`event-card${live ? " event-card--live" : ""}${event.isCLE ? " event-card--cle" : ""}`}>
      <div className="event-card-top">
        {live && <span className="live-dot" />}
        {event.isCLE && <span className="cle-badge-inline">CLE</span>}
        <strong>{event.title}</strong>
      </div>
      <div className="event-card-meta">
        <span>{format(new Date(event.startTime), "MMM d, h:mm a")}</span>
        {event.endTime && (
          <span> &ndash; {format(new Date(event.endTime), "h:mm a")}</span>
        )}
      </div>
      {event.locationText && <div className="event-card-loc">{event.locationText}</div>}
      <div className="event-card-badges">
        {event.isCLE && <span className="badge badge-cle">CLE Credit</span>}
        {event.category && <span className="badge badge-sm">{event.category}</span>}
      </div>
    </article>
  );
}
