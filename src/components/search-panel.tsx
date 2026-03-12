"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { BuildingSummary } from "@/lib/types";

type SearchResult = {
  type: "building";
  building: BuildingSummary;
  score: number;
};

type Props = {
  buildings: BuildingSummary[];
  onSelect: (building: BuildingSummary) => void;
};

/** Simple fuzzy match score: lower is better. Returns Infinity for no match. */
function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  // Exact substring match — best score
  if (t.includes(q)) return 0;

  // Prefix match
  if (t.startsWith(q)) return 0;

  // Character-by-character fuzzy match
  let qi = 0;
  let gaps = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++;
    } else {
      gaps++;
    }
  }

  // All query chars found in order
  if (qi === q.length) return gaps;

  return Infinity;
}

export function SearchPanel({ buildings, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Pre-compute lowercased names/aliases for performance
  const buildingSearchData = useMemo(() => {
    return buildings.map((b) => ({
      building: b,
      nameLower: b.name.toLowerCase(),
      aliasesLower: b.aliases.map((a) => a.toLowerCase()),
    }));
  }, [buildings]);

  const results: SearchResult[] = useMemo(() => {
    if (query.length < 1) return [];

    const scored: SearchResult[] = [];
    const q = query.toLowerCase();

    for (const { building, nameLower, aliasesLower } of buildingSearchData) {
      // Check name
      let bestScore = fuzzyScore(q, nameLower);

      // Check aliases
      for (const alias of aliasesLower) {
        const s = fuzzyScore(q, alias);
        if (s < bestScore) bestScore = s;
      }

      if (bestScore < Infinity) {
        scored.push({ type: "building", building, score: bestScore });
      }
    }

    // Sort by score (lower = better match), then by heat level (higher = more active)
    scored.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return b.building.heatLevel - a.building.heatLevel;
    });

    return scored.slice(0, 8);
  }, [query, buildingSearchData]);

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(-1);
  }, [results]);

  const handleSelect = useCallback((building: BuildingSummary) => {
    onSelect(building);
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
  }, [onSelect]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!results.length) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < results.length) {
          handleSelect(results[activeIndex].building);
        } else if (results.length > 0) {
          handleSelect(results[0].building);
        }
        break;
    }
  }, [results, activeIndex, handleSelect]);

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && resultsRef.current) {
      const item = resultsRef.current.children[activeIndex] as HTMLElement | undefined;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Close on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const heatLabel = (level: number) => {
    if (level === 4) return "live";
    if (level === 3) return "< 3h";
    if (level === 2) return "< 6h";
    if (level === 1) return "today";
    return "";
  };

  const heatClass = (level: number) => {
    if (level >= 3) return "search-heat-high";
    if (level >= 1) return "search-heat-mid";
    return "";
  };

  return (
    <div className="search-container" ref={panelRef}>
      {!open ? (
        <button
          type="button"
          className="search-trigger"
          onClick={() => setOpen(true)}
          aria-label="Search buildings"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
        </button>
      ) : (
        <div className="search-dropdown" role="combobox" aria-expanded={results.length > 0}>
          <div className="search-input-row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4, flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              ref={inputRef}
              type="text"
              className="search-input"
              placeholder="Search buildings..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              role="searchbox"
              aria-autocomplete="list"
              aria-activedescendant={activeIndex >= 0 ? `search-result-${activeIndex}` : undefined}
            />
            <button
              type="button"
              className="overlay-close"
              onClick={() => { setOpen(false); setQuery(""); }}
              style={{ width: 24, height: 24, fontSize: 14 }}
            >
              &times;
            </button>
          </div>

          {results.length > 0 && (
            <div className="search-results" ref={resultsRef} role="listbox">
              {results.map((r, i) => (
                <button
                  key={r.building.id}
                  id={`search-result-${i}`}
                  type="button"
                  className={`search-result-item${i === activeIndex ? " search-result-item--active" : ""}`}
                  onClick={() => handleSelect(r.building)}
                  onMouseEnter={() => setActiveIndex(i)}
                  role="option"
                  aria-selected={i === activeIndex}
                >
                  <div className="search-result-name">{r.building.name}</div>
                  <div className="search-result-meta">
                    <span className="badge badge-campus" style={{ fontSize: 10, padding: "1px 6px" }}>
                      {r.building.campus === "NORTH" ? "North" : r.building.campus === "SOUTH" ? "South" : "Campus"}
                    </span>
                    {r.building.heatLevel > 0 && (
                      <span className={`search-heat-badge ${heatClass(r.building.heatLevel)}`}>
                        {r.building.eventCount} event{r.building.eventCount !== 1 ? "s" : ""} &middot; {heatLabel(r.building.heatLevel)}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {query.length >= 1 && results.length === 0 && (
            <div className="search-empty">No buildings found</div>
          )}
        </div>
      )}
    </div>
  );
}
