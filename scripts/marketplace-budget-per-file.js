#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(path.join(__dirname, "..", "backend", "src", "modules", "marketplace"));

function layerOf(file) {
  const p = file.replace(/\\/g, "/");
  if (p.includes("/events/") || p.includes("/types/") || p.includes("/contracts/")) return null;
  if (p.includes("/routes/")) return "routes";
  if (path.basename(file) === "marketplace.service.ts") return "facade";
  if (p.includes("/services/")) return "services";
  if (p.includes("/application/")) return "application";
  if (p.includes("/domain/")) return "domain";
  return null;
}

function countLines(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  return content.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("//")).length;
}

function walk(dir) {
  let files = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) files = files.concat(walk(full));
    else if (full.endsWith(".ts")) files.push(full);
  }
  return files;
}

const BUDGET = { routes: 300, facade: 900, services: 500, application: 500, domain: Infinity };
const byFile = [];

for (const file of walk(ROOT)) {
  const layer = layerOf(file);
  if (layer && (layer === "routes" || layer === "services")) {
    const lines = countLines(file);
    const rel = path.relative(ROOT, file).replace(/\\/g, "/");
    byFile.push({ file: rel, layer, lines });
  }
}

byFile.sort((a, b) => b.lines - a.lines);
console.log(JSON.stringify({ byFile, BUDGET }, null, 2));
