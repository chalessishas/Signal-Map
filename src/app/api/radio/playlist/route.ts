// src/app/api/radio/playlist/route.ts
import { readFileSync } from "fs";
import { join } from "path";
import { NextRequest, NextResponse } from "next/server";
import { type Period, type Manifest, shuffle } from "@/lib/radio";

const VALID_PERIODS = ["morning", "daytime", "evening", "night"] as const;

export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get("period") as Period | null;

  if (!period || !VALID_PERIODS.includes(period)) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }

  const raw = readFileSync(
    join(process.cwd(), "public", "radio", "manifest.json"),
    "utf-8",
  );
  const manifest = JSON.parse(raw) as Manifest;
  const tracks = shuffle(manifest[period] ?? []);

  return NextResponse.json({ period, tracks });
}
