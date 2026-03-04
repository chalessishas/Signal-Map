const fs = require("fs");
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
unique.sort((a, b) => a.name.localeCompare(b.name));
console.log("Unique named buildings:", unique.length);
unique.forEach(b => console.log(JSON.stringify(b)));
