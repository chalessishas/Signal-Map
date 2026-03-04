const fs = require("fs");

// Current seed building names
const SEED_NAMES = new Set([
  "Student Union", "Wilson Library", "South Building", "Memorial Hall",
  "Morehead Planetarium", "Gerrard Hall", "Hamilton Hall", "Greenlaw Hall",
  "Hanes Art Center", "Person Hall", "Phillips Hall", "Peabody Hall",
  "Carroll Hall", "Dey Hall", "Alumni Hall", "Graham Memorial",
  "Playmakers Theatre", "Davis Library", "Undergraduate Library",
  "Genome Sciences Building", "Kenan-Flagler Business School", "Fetzer Hall",
  "Woollen Gym", "Student Recreation Center", "Carmichael Arena",
  "Dean E. Smith Center", "Koury Natatorium", "Sitterson Hall", "Brooks Hall",
  "Chapman Hall", "Murray Hall", "Venable Hall", "Kenan Labs", "Caudill Labs",
  "Lenoir Dining Hall", "Chase Hall", "Bondurant Hall", "UNC Hospitals",
  "School of Public Health", "Kenan Stadium", "Boshamer Stadium",
  "Carolina Performing Arts", "FedEx Global Education Center", "Friday Center",
  "Stone Center", "Campus Y", "Carolina Hall", "McCorkle Place", "Polk Place",
  "The Pit", "Hill Hall", "Ackland Art Museum", "Hooker Fields", "Swain Hall",
  "SASB", "Murphey Hall", "Gardner Hall", "UNC Visitors Center", "Kenan Theatre",
  "Student Wellness", "McColl Building", "Old Well", "Loudermilk Center",
  "Henry Stadium", "Eddie Smith Field House", "Rams Head", "Bingham Hall",
  "Manning Hall", "New West", "Coker Hall", "Health Sciences Library",
  "Rosenau Hall", "Howell Hall", "Hanes Hall", "Hyde Hall", "Bell Hall",
  "Kerr Hall", "George Watts Hill Alumni Center", "Carolina Club",
  "Friday Conference Center", "Genetic Medicine Building",
  "Tate-Turner-Kuralt Building", "North Carolina Botanical Garden",
  "Craige Residence Hall", "Varsity Theatre", "Mitchell Hall"
]);

// GeoJSON names to skip (non-university, commercial, churches, parking, etc.)
const SKIP_PATTERNS = [
  /parking/i, /deck$/i, /chiller/i, /trailer/i, /steam plant/i,
  /church/i, /baptist/i, /methodist/i, /latter-day/i, /synagogue/i,
  /unitarian/i, /tattoo/i, /sup dogs/i, /imbibe/i, /tru deli/i,
  /first horizon/i, /truist/i, /credit union/i, /fire department/i,
  /courthouse/i, /hero mold/i, /valet/i, /140 west/i, /spring garden/i,
  /alpha|beta|chi|delta|gamma|kappa|lambda|mu|phi|pi |psi|sigma|tau|zeta|theta|omega/i,
  /maintenance/i, /storeroom/i, /physical plant/i, /electric dist/i,
  /energy services/i, /annex/i, /the manse/i, /the agora/i,
  /med\. b/i, /medical school building/i, /medical school wings/i,
  /south chiller/i, /southside/i, /cogeneration/i, /porthole/i,
  /shops$/i
];

const geo = JSON.parse(fs.readFileSync("public/buildings.geojson", "utf8"));
const named = geo.features
  .filter(f => f.properties.n)
  .map(f => ({ name: f.properties.n, lat: f.properties.c[0], lng: f.properties.c[1] }));

const seen = new Set();
const unique = [];
for (const b of named) {
  if (!seen.has(b.name)) {
    seen.add(b.name);
    unique.push(b);
  }
}

// Find missing ones
const missing = unique.filter(b => {
  // Skip if already in seed (fuzzy match)
  const lower = b.name.toLowerCase();
  for (const s of SEED_NAMES) {
    if (lower.includes(s.toLowerCase()) || s.toLowerCase().includes(lower)) return false;
  }
  // Skip non-university buildings
  for (const p of SKIP_PATTERNS) {
    if (p.test(b.name)) return false;
  }
  return true;
});

missing.sort((a, b) => a.name.localeCompare(b.name));
console.log("Missing buildings:", missing.length);
missing.forEach(b => console.log(JSON.stringify(b)));
