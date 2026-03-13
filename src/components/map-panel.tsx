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

const HEAT_STYLES: Record<HeatLevel, { fill: string; fillOp: number; stroke: string; weight: number }> = {
  0: { fill: "#adb5bd", fillOp: 0.18, stroke: "#868e96", weight: 0.8 },
  1: { fill: "#40c057", fillOp: 0.35, stroke: "#2f9e44", weight: 1.2 },
  2: { fill: "#fab005", fillOp: 0.42, stroke: "#e67700", weight: 1.3 },
  3: { fill: "#fd7e14", fillOp: 0.48, stroke: "#d9480f", weight: 1.5 },
  4: { fill: "#fa5252", fillOp: 0.58, stroke: "#e03131", weight: 1.8 },
};

const BG_STYLE = { fill: "#ced4da", fillOp: 0.18, stroke: "#adb5bd", weight: 0.6 };
const SELECTED_STYLE = { fill: "#4263eb", fillOp: 0.65, stroke: "transparent", weight: 0 };

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

function heatTooltip(b: BuildingSummary): string {
  const lines: string[] = [b.name];
  if (b.happeningNowCount > 0) {
    lines.push(`<span class="tooltip-heat">${b.happeningNowCount} happening now</span>`);
  } else if (b.nextEventStartsAt) {
    const dist = formatDistanceToNow(new Date(b.nextEventStartsAt), { addSuffix: false });
    lines.push(`<span class="tooltip-heat">Next in ${dist}</span>`);
  } else if (b.eventCount > 0) {
    lines.push(`<span class="tooltip-heat">${b.eventCount} upcoming</span>`);
  }
  if (b.cleCount > 0) {
    lines.push(`<span class="tooltip-cle">CLE ${b.cleCount}</span>`);
  }
  return lines.join("<br>");
}

/* ─── Component ─── */

type MapPanelProps = {
  initialBuildings: BuildingSummary[];
  categories: string[];
};

export function MapPanel({ initialBuildings, categories }: MapPanelProps) {
  const mapRef = useRef<unknown>(null);
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const selectedRef = useRef<{ layer: unknown; building: BuildingSummary | null }>({ layer: null, building: null });
  const abortRef = useRef<AbortController | null>(null);

  const [state, setState] = useState<PanelState>({
    building: null,
    now: [],
    upcoming: [],
    loading: false,
  });

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);

  // When a category is active, filter events in the bottom panel
  const filteredNow = useMemo(() => {
    if (!activeCategory) return state.now;
    return state.now.filter((e) => e.category === activeCategory);
  }, [state.now, activeCategory]);

  const filteredUpcoming = useMemo(() => {
    if (!activeCategory) return state.upcoming;
    return state.upcoming.filter((e) => e.category === activeCategory);
  }, [state.upcoming, activeCategory]);

  const selectBuilding = useCallback(async (building: BuildingSummary, category?: string | null) => {
    // Cancel any in-flight request to prevent race conditions
    if (abortRef.current) {
      abortRef.current.abort();
    }
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
    if (category) {
      query.set("category", category);
    }

    try {
      const response = await fetch(`/api/events?${query.toString()}`, {
        signal: controller.signal,
      });
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
      // Ignore aborted requests — a newer request has taken over
      if (err instanceof DOMException && err.name === "AbortError") return;
      setState({ building, now: [], upcoming: [], loading: false });
    }
  }, []);

  // Re-fetch events when category filter changes and a building is selected
  useEffect(() => {
    if (state.building) {
      void selectBuilding(state.building, activeCategory);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory]);

  const handleCategoryToggle = useCallback((cat: string) => {
    setActiveCategory((prev) => (prev === cat ? null : cat));
  }, []);

  const resetSelectedStyle = useCallback(() => {
    if (selectedRef.current.layer && selectedRef.current.building) {
      const prev = selectedRef.current.layer as { setStyle: (s: Record<string, unknown>) => void; _path?: SVGPathElement };
      const hl = selectedRef.current.building.heatLevel;
      const s = HEAT_STYLES[hl as HeatLevel];
      prev.setStyle({ fillColor: s.fill, fillOpacity: s.fillOp, color: s.stroke, weight: s.weight });
      if (prev._path) {
        prev._path.classList.remove("building-selected-3d");
        if (hl > 0) prev._path.classList.add(`building-heat-${hl}`);
      }
    }
  }, []);

  const closeOverlay = useCallback(() => {
    resetSelectedStyle();
    selectedRef.current = { layer: null, building: null };
    setState({ building: null, now: [], upcoming: [], loading: false });
    if (mapRef.current) {
      (mapRef.current as { flyTo: (c: [number, number], z: number, o: Record<string, number>) => void })
        .flyTo(UNC_CENTER, 16, { duration: 0.6 });
    }
  }, [resetSelectedStyle]);

  const handleSearchSelect = useCallback((building: BuildingSummary) => {
    resetSelectedStyle();
    selectedRef.current = { layer: null, building: building };
    if (mapRef.current) {
      const offsetLat = building.lat - 0.0012;
      (mapRef.current as { flyTo: (c: { lat: number; lng: number }, z: number, o: Record<string, number>) => void })
        .flyTo({ lat: offsetLat, lng: building.lng }, 18, { duration: 0.8 });
    }
    void selectBuilding(building, activeCategory);
  }, [selectBuilding, resetSelectedStyle, activeCategory]);

  // Keyboard: Escape to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && state.building) closeOverlay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.building, closeOverlay]);

  // Initialize map
  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) return;
    let cancelled = false;
    // Track the map instance locally so cleanup can always reach it,
    // even if the Promise resolves after the component unmounts.
    let localMap: { remove: () => void } | null = null;

    import("leaflet").then(async (L) => {
      if (cancelled || !mapNodeRef.current) return;

      const map = L.map(mapNodeRef.current, {
        center: UNC_CENTER,
        zoom: 16,
        zoomControl: false,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      }).addTo(map);

      // Build building index
      const buildingIndex = new Map<number, BuildingSummary>();

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
      // Pass 1: match by name (OSM name matches any DB building alias)
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

      L.geoJSON(geojson as GeoJSON.GeoJsonObject, {
        style: (feature) => {
          if (!feature) return {};
          const idx = geojson!.features.indexOf(feature as GeoJSONFeature);
          const matched = buildingIndex.get(idx);

          if (matched) {
            const s = HEAT_STYLES[matched.heatLevel as HeatLevel];
            const classes = ["building-poly"];
            if (matched.heatLevel > 0) classes.push(`building-heat-${matched.heatLevel}`);
            if (matched.cleCount > 0) classes.push("building-cle");
            return {
              fillColor: s.fill,
              fillOpacity: s.fillOp,
              color: s.stroke,
              weight: s.weight,
              className: classes.join(" "),
            };
          }

          return {
            fillColor: BG_STYLE.fill,
            fillOpacity: BG_STYLE.fillOp,
            color: BG_STYLE.stroke,
            weight: BG_STYLE.weight,
            className: "building-poly-bg",
          };
        },

        onEachFeature: (feature, layer) => {
          const idx = geojson!.features.indexOf(feature as GeoJSONFeature);
          const matched = buildingIndex.get(idx);
          const osmName = (feature as GeoJSONFeature).properties.n;
          const path = layer as unknown as { _path?: SVGPathElement; setStyle: (s: Record<string, unknown>) => void };

          // Tooltip for all buildings
          if (matched) {
            layer.bindTooltip(heatTooltip(matched), {
              direction: "top",
              offset: [0, -4],
              className: "building-tooltip",
            });
          } else if (osmName) {
            layer.bindTooltip(osmName, {
              direction: "top",
              offset: [0, -4],
              className: "building-tooltip",
            });
          }

          // Hover for all buildings
          layer.on("mouseover", () => {
            if (selectedRef.current.layer === layer) return;
            if (matched) {
              const s = HEAT_STYLES[matched.heatLevel as HeatLevel];
              (layer as L.Path).setStyle({
                fillOpacity: Math.min(s.fillOp + 0.15, 0.85),
                weight: s.weight + 0.8,
              });
              if (path._path) {
                path._path.style.filter = `drop-shadow(0 0 6px ${s.stroke})`;
              }
            } else {
              (layer as L.Path).setStyle({
                fillOpacity: 0.25,
                weight: 0.8,
                fillColor: "#d4c9a8",
              });
              if (path._path) {
                path._path.style.filter = "drop-shadow(0 0 3px rgba(212,201,168,0.5))";
              }
            }
          });

          layer.on("mouseout", () => {
            if (selectedRef.current.layer === layer) return;
            if (matched) {
              const s = HEAT_STYLES[matched.heatLevel as HeatLevel];
              (layer as L.Path).setStyle({
                fillOpacity: s.fillOp,
                weight: s.weight,
              });
            } else {
              (layer as L.Path).setStyle({
                fillOpacity: BG_STYLE.fillOp,
                weight: BG_STYLE.weight,
                fillColor: BG_STYLE.fill,
              });
            }
            if (path._path) path._path.style.filter = "";
          });

          // Click for matched buildings
          if (matched) {
            layer.on("click", (e: L.LeafletEvent) => {
              // Stop propagation so map's click handler doesn't fire closeOverlay
              L.DomEvent.stopPropagation(e as unknown as Event);

              // If clicking already selected, zoom back out
              if (selectedRef.current.building?.id === matched.id) {
                closeOverlay();
                return;
              }

              // Deselect previous
              resetSelectedStyle();

              // Select new
              (layer as L.Path).setStyle({
                fillColor: SELECTED_STYLE.fill,
                fillOpacity: SELECTED_STYLE.fillOp,
                color: SELECTED_STYLE.stroke,
                weight: SELECTED_STYLE.weight,
              });

              selectedRef.current = { layer, building: matched };

              // FlyTo with offset: shift target south so building appears
              // in the upper third of the viewport (above the bottom panel)
              const offsetLat = matched.lat - 0.0012;
              const flyTarget = L.latLng(offsetLat, matched.lng);
              map.flyTo(flyTarget, 18, { duration: 0.8 });

              // Apply 3D effect after flight
              map.once("moveend", () => {
                if (path._path) {
                  path._path.classList.remove(`building-heat-${matched.heatLevel}`);
                  path._path.classList.add("building-selected-3d");
                }
              });

              void selectBuilding(matched);
            });
          }
        },
      }).addTo(map);

      // Click on map (not on building) to close
      map.on("click", () => {
        if (selectedRef.current.building) {
          closeOverlay();
        }
      });

      localMap = map;
      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      // Use localMap as fallback — if the promise resolved but mapRef
      // wasn't set yet (unlikely but possible), we still clean up.
      const mapToRemove = mapRef.current ?? localMap;
      if (mapToRemove) {
        (mapToRemove as { remove: () => void }).remove();
        mapRef.current = null;
        localMap = null;
      }
      // Cancel any pending fetch
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [initialBuildings, selectBuilding, closeOverlay]);

  return (
    <>
      <div ref={mapNodeRef} style={{ position: "absolute", inset: 0 }} />

      {/* Theme toggle */}
      <ThemeToggle />

      {/* Search */}
      <SearchPanel buildings={initialBuildings} onSelect={handleSearchSelect} />

      {/* Category filter bar */}
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

      {/* Legend — collapsible */}
      <div className={`map-legend${legendOpen ? " map-legend--open" : ""}`}>
        <button
          type="button"
          className="legend-toggle"
          onClick={() => setLegendOpen((o) => !o)}
          aria-label="Toggle legend"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
          </svg>
          {!legendOpen && <span className="legend-toggle-label">Legend</span>}
        </button>
        {legendOpen && (
          <div className="legend-items">
            <div className="legend-item">
              <span className="legend-swatch legend-heat-4" />
              <span>Happening Now</span>
            </div>
            <div className="legend-item">
              <span className="legend-swatch legend-heat-3" />
              <span>Within 3h</span>
            </div>
            <div className="legend-item">
              <span className="legend-swatch legend-heat-2" />
              <span>Within 6h</span>
            </div>
            <div className="legend-item">
              <span className="legend-swatch legend-heat-1" />
              <span>Later Today</span>
            </div>
            <div className="legend-item">
              <span className="legend-swatch legend-heat-0" />
              <span>No Events</span>
            </div>
            <div className="legend-item">
              <span className="legend-swatch legend-cle" />
              <span>CLE Credit</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom overlay */}
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
