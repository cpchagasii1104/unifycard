const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MODULE_DIR = path.join(ROOT, "backend/src/modules/marketplace");
const FACADE_FILE = path.join(MODULE_DIR, "marketplace.service.ts");

const content = fs.readFileSync(FACADE_FILE, "utf8");

const mapRegex = /private\s+([a-zA-Z0-9_]+)\s*:\s*Map<([^>]+)>/g;

const state = [];

let match;

while ((match = mapRegex.exec(content))) {
  state.push({
    name: match[1],
    type: match[2],
  });
}

console.log("\n=== STATE MAPS IN FACADE ===\n");

state.forEach((s) => {
  console.log(`${s.name} : Map<${s.type}>`);
});

console.log("\nTotal Maps:", state.length, "\n");
