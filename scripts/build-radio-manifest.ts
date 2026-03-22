// scripts/build-radio-manifest.ts
import fs from "fs";
import path from "path";

type Track = { title: string; artist: string; file: string; duration: number };
type Manifest = Record<string, Track[]>;

const RADIO_DIR = path.join(process.cwd(), "public", "radio");
const PERIODS = ["morning", "daytime", "evening", "night"];

const manifest: Manifest = {};

for (const period of PERIODS) {
  const dir = path.join(RADIO_DIR, period);
  if (!fs.existsSync(dir)) {
    manifest[period] = [];
    continue;
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".mp3"));
  manifest[period] = files.map((f) => {
    const name = f.replace(".mp3", "");
    // Convention: "artist - title.mp3" or just "title.mp3"
    const parts = name.split(" - ");
    return {
      title: parts.length > 1 ? parts[1].trim() : parts[0].trim(),
      artist: parts.length > 1 ? parts[0].trim() : "Unknown",
      file: `/radio/${period}/${f}`,
      duration: 0, // Duration can be filled later with an audio probe
    };
  });
}

const outPath = path.join(RADIO_DIR, "manifest.json");
fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2));
console.log(`Radio manifest written: ${Object.values(manifest).flat().length} tracks total`);
