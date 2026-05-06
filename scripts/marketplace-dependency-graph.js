#!/usr/bin/env node
/**
 * Gera grafo de dependências do módulo marketplace a partir dos imports reais.
 * Saída: Mermaid flowchart. Uso: node scripts/marketplace-dependency-graph.js
 * Pode ser rodado no CI para detectar import indevido / violação de camada.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MODULE = path.join(ROOT, "backend/src/modules/marketplace");

function layerOf(filePath) {
  const rel = path.relative(MODULE, filePath);
  const sep = path.sep;
  if (rel.includes(sep + "types" + sep) || rel.startsWith("types" + sep)) return "types";
  if (rel.includes("shared" + sep) || rel.includes("contracts" + sep)) return "types";
  if (rel.startsWith("routes" + sep) || rel === "marketplace.routes.ts") return "routes";
  if (rel === "marketplace.service.ts") return "facade";
  if (rel.startsWith("services" + sep)) return "services";
  if (rel.startsWith("domain" + sep)) return "domain";
  if (rel.startsWith("application" + sep) || rel.includes("application/")) return "application";
  if (rel.startsWith("core" + sep) || rel.includes("core/")) return "core";
  if (rel.startsWith("events" + sep) || rel.includes("events/")) return "events";
  return "other";
}

function* walkTs(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== "node_modules" && !e.name.startsWith(".")) {
      yield* walkTs(full);
    } else if (e.isFile() && e.name.endsWith(".ts") && !e.name.endsWith(".d.ts")) {
      yield full;
    }
  }
}

const importRe = /(?:from\s+['"]([^'"]+)['"])|(?:require\s*\(\s*['"]([^'"]+)['"])/g;

function layerFromImport(fromFile, importPath) {
  if (!importPath.startsWith(".")) return null;
  const dir = path.dirname(fromFile);
  const resolved = path.normalize(path.join(dir, importPath));
  const rel = path.relative(MODULE, path.resolve(resolved));
  if (rel.startsWith("..")) return null;
  const sep = path.sep;
  if (rel.includes(sep + "types" + sep) || rel.startsWith("types" + sep) || rel.includes("shared") || rel.includes("contracts")) return "types";
  if (rel.startsWith("routes" + sep)) return "routes";
  if (rel.startsWith("services" + sep)) return "services";
  if (rel.startsWith("domain" + sep)) return "domain";
  if (rel.startsWith("application" + sep) || rel.includes("application/")) return "application";
  if (rel.startsWith("core" + sep) || rel.includes("core/")) return "core";
  if (rel.startsWith("events" + sep) || rel.includes("events/")) return "events";
  if (rel === "marketplace.service.ts") return "facade";
  return null;
}

const edgeSet = new Set();
const edgeList = [];
const nodes = new Set();

function extractImports(content) {
  const imports = [];
  const lineRe = /(?:from\s+['"]([^'"]+)['"])|(?:require\s*\(\s*['"]([^'"]+)['"])/g;
  const lines = content.split("\n");
  for (const line of lines) {
    if (line.trimStart().startsWith("import type ")) continue;
    let m;
    lineRe.lastIndex = 0;
    while ((m = lineRe.exec(line)) !== null) {
      imports.push((m[1] || m[2] || "").trim());
    }
  }
  return imports;
}

for (const file of walkTs(MODULE)) {
  const fromLayer = layerOf(file);
  const content = fs.readFileSync(file, "utf8");
  const imports = extractImports(content);
  for (const imp of imports) {
    const toLayer = layerFromImport(file, imp);
    if (toLayer && fromLayer !== toLayer) {
      edgeSet.add(`${fromLayer} --> ${toLayer}`);
      edgeList.push({ from: fromLayer, to: toLayer });
      nodes.add(fromLayer);
      nodes.add(toLayer);
    }
  }
}

function findCycle(edges) {
  const adj = new Map();
  for (const { from: u, to: v } of edges) {
    if (!adj.has(u)) adj.set(u, []);
    adj.get(u).push(v);
  }
  const path = [];
  const inPath = new Set();
  const visited = new Set();

  function dfs(node) {
    if (inPath.has(node)) {
      const start = path.indexOf(node);
      return path.slice(start).concat(node);
    }
    if (visited.has(node)) return null;
    visited.add(node);
    path.push(node);
    inPath.add(node);
    for (const next of adj.get(node) || []) {
      const cycle = dfs(next);
      if (cycle) return cycle;
    }
    path.pop();
    inPath.delete(node);
    return null;
  }

  for (const n of adj.keys()) {
    if (!visited.has(n)) {
      const cycle = dfs(n);
      if (cycle) return cycle;
    }
  }
  return null;
}

// Validação de direção de camadas (domain terminal; sem dependência inválida)
// Regras explícitas: facade NÃO → domain nem events; events NÃO → domain (handlers chamam services).
const ALLOWED = {
  routes: ["facade", "types"],
  facade: ["services", "application", "types"],
  services: ["domain", "core", "types"],
  application: ["domain", "core", "types"],
  domain: ["events", "core", "types"],
  events: ["services", "core", "types"],
  core: ["types"],
  types: [],
  other: ["services", "application", "domain", "core", "types", "events"],
};

let invalidEdge = null;
for (const { from: fromLayer, to: toLayer } of edgeList) {
  const allowed = ALLOWED[fromLayer];
  if (allowed && !allowed.includes(toLayer)) {
    invalidEdge = { from: fromLayer, to: toLayer };
    break;
  }
}
if (invalidEdge) {
  console.error("[marketplace-dependency-graph] ❌ Direção de camada inválida:");
  console.error(`  ${invalidEdge.from} não pode depender de ${invalidEdge.to}`);
  console.error("  Esperado: routes → facade → services/application → domain → events");
  process.exit(1);
}

const cycle = findCycle(edgeList);
if (cycle) {
  console.error("[marketplace-dependency-graph] ❌ Dependência circular detectada:");
  console.error("  " + cycle.join(" → "));
  process.exit(1);
}

const lines = ["flowchart LR", "  subgraph marketplace", "    direction TB"];
const ordered = ["routes", "facade", "services", "application", "domain", "events", "core", "types", "other"].filter((n) => nodes.has(n));
for (const n of ordered) {
  if (nodes.has(n)) lines.push(`    ${n}[${n}]`);
}
for (const e of [...edgeSet].sort()) {
  lines.push(`    ${e}`);
}
lines.push("  end");
lines.push("");
lines.push("%% Gerado por scripts/marketplace-dependency-graph.js");

console.log(lines.join("\n"));
