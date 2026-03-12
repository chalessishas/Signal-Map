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

// Constellation star sizes based on heat level
const STAR_RADIUS: Record<HeatLevel, number> = {
  0: 0,
  1: 4,
  2: 6,
  3: 8,
  4: 10,
};

// Star colors (warm white to hot colors for higher heat)
const STAR_COLORS: Record<HeatLevel, { fill: string; glow: string; glowSize: number }> = {
  0: { fill: "#6b7280", glow: "rgba(107,114,128,0)", glowSize: 0 },
  1: { fill: "#e8e8e0", glow: "rgba(232,232,224,0.4)", glowSize: 8 },
  2: { fill: "#ffd666", glow: "rgba(255,214,102,0.5)", glowSize: 12 },
  3: { fill: "#ff9f43", glow: "rgba(255,159,67,0.6)", glowSize: 16 },
  4: { fill: "#ff6b6b", glow: "rgba(255,107,107,0.7)", glowSize: 22 },
};

// CLE special color
const CLE_GLOW = "rgba(77,171,247,0.7)";
const CLE_COLOR = "#4dabf7";

// Ghost polygon styles (very subtle building outlines)
const GHOST_STYLE = { fill: "#ffffff", fillOp: 0.03, stroke: "rgba(255,255,255,0.06)", weight: 0.5 };
const GHOST_ACTIVE_STYLE = { fill: "#ffffff", fillOp: 0.06, stroke: "rgba(255,255,255,0.12)", weight: 0.8 };

// Max distance (meters) between buildings to draw constellation lines
const CONSTELLATION_LINK_DIST = 300;

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
  const [hoveredBuilding, setHoveredBuilding] = useState<BuildingSummary | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

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

      // Dark tile layer for constellation effect
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
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

      // ── Layer 1: Ghost building polygons (very subtle) ──
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
          // No interactions on ghost polys
          (layer as L.Path).options.interactive = false;
        },
      }).addTo(map);

      // ── Collect active buildings for star/constellation layers ──
      for (const building of initialBuildings) {
        if (building.heatLevel > 0) {
          activeBuildings.push(building);
        }
      }

      // ── Layer 2: Constellation lines (connect nearby active buildings) ──
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

            // Line opacity based on heat sum
            const heatSum = a.heatLevel + b.heatLevel;
            const opacity = Math.min(0.08 + heatSum * 0.04, 0.35);

            L.polyline(
              [
                [a.lat, a.lng],
                [b.lat, b.lng],
              ],
              {
                color: "rgba(255,255,255,0.5)",
                weight: 0.8,
                opacity,
                dashArray: "4 6",
                className: "constellation-line",
                interactive: false,
              }
            ).addTo(map);
          }
        }
      }

      // ── Layer 3: Star markers ──
      for (const building of activeBuildings) {
        const hl = building.heatLevel as HeatLevel;
        const star = STAR_COLORS[hl];
        const radius = STAR_RADIUS[hl];
        const isCLE = building.cleCount > 0;

        // Outer glow circle
        if (star.glowSize > 0) {
          L.circleMarker([building.lat, building.lng], {
            radius: star.glowSize,
            fillColor: isCLE ? CLE_COLOR : star.fill,
            fillOpacity: isCLE ? 0.15 : 0.1,
            color: "transparent",
            weight: 0,
            className: `star-glow star-glow-${hl}${isCLE ? " star-cle-glow" : ""}`,
            interactive: false,
          }).addTo(map);
        }

        // CLE halo ring
        if (isCLE) {
          L.circleMarker([building.lat, building.lng], {
            radius: radius + 6,
            fillColor: "transparent",
            fillOpacity: 0,
            color: CLE_COLOR,
            weight: 1.5,
            opacity: 0.5,
            dashArray: "3 3",
            className: "star-cle-ring",
            interactive: false,
          }).addTo(map);
        }

        // Core star
        const starMarker = L.circleMarker([building.lat, building.lng], {
          radius,
          fillColor: star.fill,
          fillOpacity: 0.95,
          color: star.fill,
          weight: 1,
          opacity: 0.6,
          className: `star-core star-core-${hl}${isCLE ? " star-cle" : ""}`,
        });

        // Tooltip
        const tooltipLines: string[] = [
          `<span class="star-tooltip-name">${building.name}</span>`,
        ];
        if (building.happeningNowCount > 0) {
          tooltipLines.push(`<span class="star-tooltip-live">${building.happeningNowCount} happening now</span>`);
        } else if (building.nextEventStartsAt) {
          const dist = formatDistanceToNow(new Date(building.nextEventStartsAt), { addSuffix: false });
          tooltipLines.push(`<span class="star-tooltip-time">Next in ${dist}</span>`);
        }
        if (building.eventCount > 0) {
          tooltipLines.push(`<span class="star-tooltip-count">${building.eventCount} events</span>`);
        }
        if (isCLE) {
          tooltipLines.push(`<span class="star-tooltip-cle">CLE ${building.cleCount}</span>`);
        }

        starMarker.bindTooltip(tooltipLines.join("<br>"), {
          direction: "top",
          offset: [0, -radius - 4],
          className: "star-tooltip",
        });

        // Hover → show building in state for hover card
        starMarker.on("mouseover", (e: L.LeafletEvent) => {
          setHoveredBuilding(building);
          const containerPoint = map.latLngToContainerPoint(
            (e as L.LeafletMouseEvent).latlng
          );
          setHoverPos({ x: containerPoint.x, y: containerPoint.y });
        });

        starMarker.on("mouseout", () => {
          setHoveredBuilding(null);
          setHoverPos(null);
        });

        // Click → select building, show bottom detail panel
        starMarker.on("click", (e: L.LeafletEvent) => {
          L.DomEvent.stopPropagation(e as unknown as Event);
          const offsetLat = building.lat - 0.0012;
          map.flyTo(L.latLng(offsetLat, building.lng), 18, { duration: 0.8 });
          setState((prev) => ({ ...prev, building, loading: true }));

          // Fetch events
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

      // Click on map to close
      map.on("click", () => {
        if (state.building) {
          setState({ building: null, now: [], upcoming: [], loading: false });
          map.flyTo(UNC_CENTER, 16, { duration: 0.6 });
        }
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

  return (
    <>
      <div ref={mapNodeRef} style={{ position: "absolute", inset: 0 }} />

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

      {/* Category filter bar — bottom center */}
      {categories.length > 0 && (
        <div className="filter-bar">
          <button
            type="button"
            className={`filter-pill${activeCategory === null ? " filter-pill--active" : ""}`}
            onClick={() => setActiveCategory(null)}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`filter-pill${activeCategory === cat ? " filter-pill--active" : ""}`}
              onClick={() => handleCategoryToggle(cat)}
            >
              <span className="filter-pill-icon">{getCategoryIcon(cat)}</span>
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Hover card (follows mouse near star) */}
      {hoveredBuilding && hoverPos && (
        <div
          className="star-hover-card"
          style={{
            left: hoverPos.x + 16,
            top: hoverPos.y - 20,
          }}
        >
          <div className="star-hover-name">{hoveredBuilding.name}</div>
          <div className="star-hover-meta">
            {hoveredBuilding.happeningNowCount > 0 && (
              <span className="star-hover-live">{hoveredBuilding.happeningNowCount} live</span>
            )}
            <span>{hoveredBuilding.eventCount} events</span>
            {hoveredBuilding.cleCount > 0 && (
              <span className="star-hover-cle">CLE {hoveredBuilding.cleCount}</span>
            )}
          </div>
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
