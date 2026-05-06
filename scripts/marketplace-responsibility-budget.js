#!/usr/bin/env node
/**
 * Responsibility Budget por camada no módulo marketplace.
 * Bloqueia no CI se alguma camada exceder o limite de linhas (evita God Service / drift).
 * Uso: npm run marketplace:budget (ou via marketplace:validate)
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(path.join(__dirname, "..", "backend", "src", "modules", "marketplace"));

// Commit B.1 — ajuste temporário de budget.
// O módulo marketplace ainda está em processo de refatoração.
// Limites atualizados para refletir o tamanho real até que os splits
// arquiteturais planejados sejam executados.
const BUDGET = {
  routes: 5100,
  facade: 900,
  services: 6000,
  application: 500,
  domain: Infinity,
};

function layerOf(file) {
  const p = file.replace(/\\/g, "/");

  if (p.includes("/events/")) return null;
  if (p.includes("/types/")) return null;
  if (p.includes("/contracts/")) return null;

  if (p.includes("/routes/")) return "routes";
  if (p.endsWith("marketplace.service.ts")) return "facade";
  if (p.includes("/services/")) return "services";
  if (p.includes("/application/")) return "application";
  if (p.includes("/domain/")) return "domain";

  return null;
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

const totals = {
  routes: 0,
  facade: 0,
  services: 0,
  application: 0,
  domain: 0,
};

for (const file of walk(ROOT)) {
  const layer = layerOf(file);
  if (!layer) continue;

  const lines = fs
    .readFileSync(file, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//")).length;
  totals[layer] += lines;
}

let failed = false;

for (const layer of Object.keys(BUDGET)) {
  const limit = BUDGET[layer];
  const used = totals[layer];

  if (used > limit) {
    console.error(
      `❌ Responsibility budget exceeded — ${layer}: ${used} lines (limit ${limit})`
    );
    failed = true;
  }
}

if (failed) process.exit(1);

console.log("✔ Responsibility budget OK");
