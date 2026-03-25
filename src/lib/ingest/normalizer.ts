import { prisma } from "@/lib/prisma";
import type { ParsedEvent } from "@/lib/ingest/types";

function simplify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Split into lowercase alpha-only tokens for word-level matching */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((t) => t.length > 1);
}

/**
 * Score how well `source` matches `candidate`.
 * Returns a value between 0 (no match) and 1 (perfect).
 * Uses a combination of substring inclusion and token overlap.
 */
function matchScore(source: string, candidate: string): number {
  const sSimple = simplify(source);
  const cSimple = simplify(candidate);

  // Exact substring match (strongest signal)
  if (sSimple.includes(cSimple) || cSimple.includes(sSimple)) return 1;

  // Token overlap — for "Davis Library" matching "Davis Lib" or reordered words
  const sTokens = tokenize(source);
  const cTokens = tokenize(candidate);
  if (cTokens.length === 0) return 0;

  let matched = 0;
  for (const ct of cTokens) {
    if (sTokens.some((st) => st.includes(ct) || ct.includes(st))) {
      matched++;
    }
  }

  const overlap = matched / cTokens.length;
  // Require at least 60% token overlap to avoid false positives
  return overlap >= 0.6 ? overlap * 0.9 : 0;
}

/** Haversine distance in meters */
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type BuildingRow = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  aliases: string;
};

/** Common abbreviations used in event location text */
const ABBREVIATIONS: Record<string, string> = {
  "gl": "greenlaw",
  "dey": "dey hall",
  "ch": "carolina hall",
  "sa": "student union",
  "su": "student union",
  "mh": "memorial hall",
  "gb": "genome sciences building",
  "fd": "fetzer",
  "mas": "medical education building",
  "pcm": "phillips hall",
};

/**
 * Direct location text → building ID mappings for locations the fuzzy matcher can't resolve.
 * Covers: typos, informal names, sub-locations within known buildings.
 */
const DIRECT_MAPPINGS: Record<string, string> = {
  // Typos
  "aumni hall": "bld_015",           // "Aumni Hall 0207" → Alumni Hall
  // Informal / partial names
  "genome science": "bld_020",       // Genome Sciences Building
  "genome": "bld_020",
  "smith": "bld_026",                // Dean E. Smith Center
  "bell": "bld_076",                 // Bell Hall
  "cuab": "bld_001",                 // CUAB Suite is in Student Union
  "cuab suite": "bld_001",
  "library data services": "bld_018", // Davis Library
  "media and design center": "bld_143", // Curtis Media Center
  "weaver": "bld_001",               // Weavers Grove events default to Student Union (closest hub)
  "weavers grove": "bld_001",
  "weavers grove build": "bld_001",
  "carolina women's center": "bld_001", // Located in Student Union
};

export async function resolveBuildingId(
  locationText: string | undefined,
  lat: number | undefined,
  lng: number | undefined,
  buildings: BuildingRow[]
): Promise<string | undefined> {
  // Strategy 1: Match by name/alias with scored fuzzy matching
  if (locationText) {
    // Strategy 0: Direct mapping for known typos/informal names
    const locLower = locationText.toLowerCase().replace(/\s+\d+$/, "").trim(); // strip room numbers
    for (const [pattern, buildingId] of Object.entries(DIRECT_MAPPINGS)) {
      if (locLower === pattern || locLower.startsWith(pattern + " ")) {
        return buildingId;
      }
    }

    // Strategy 1a: Check abbreviation prefix first (e.g. "GL-0104" → "greenlaw")
    const prefixMatch = locationText.match(/^([A-Za-z]{2,4})[\s\-]/);
    if (prefixMatch) {
      const abbr = prefixMatch[1].toLowerCase();
      const expanded = ABBREVIATIONS[abbr];
      if (expanded) {
        for (const building of buildings) {
          if (matchScore(building.name, expanded) >= 0.6) {
            return building.id;
          }
        }
      }
    }

    // Strategy 1b: Score each building against the location text
    let bestScore = 0;
    let bestId: string | undefined;

    for (const building of buildings) {
      let aliases: string[] = [];
      try {
        const parsed = JSON.parse(building.aliases);
        if (Array.isArray(parsed)) aliases = parsed;
      } catch {
        // malformed aliases — skip
      }

      const labels = [building.name, ...aliases];
      for (const label of labels) {
        const score = matchScore(locationText, label);
        if (score > bestScore) {
          bestScore = score;
          bestId = building.id;
        }
      }
    }

    // Require at least 0.6 to avoid false positives
    if (bestId && bestScore >= 0.6) return bestId;
  }

  // Strategy 2: Match by coordinates (find nearest building within 100m)
  if (lat !== undefined && lng !== undefined) {
    let bestId: string | undefined;
    let bestDist = 100; // max 100 meters

    for (const building of buildings) {
      const dist = distanceMeters(lat, lng, building.lat, building.lng);
      if (dist < bestDist) {
        bestDist = dist;
        bestId = building.id;
      }
    }

    return bestId;
  }

  return undefined;
}

export async function normalizeEvents(events: ParsedEvent[]) {
  const buildings = await prisma.building.findMany({
    select: { id: true, name: true, lat: true, lng: true, aliases: true },
  });

  const normalized = [] as Array<ParsedEvent & { buildingId?: string }>;

  for (const event of events) {
    const buildingId = await resolveBuildingId(
      event.locationText,
      event.latitude,
      event.longitude,
      buildings
    );
    normalized.push({ ...event, buildingId });
  }

  return normalized;
}
