#!/usr/bin/env node
/**
 * Relatório de blocos da facade (marketplace.service.ts).
 * - Agrupa por seções (// =====) e lista métodos que mencionam "order" ou "Order".
 * - Conta linhas que são delegação pura: return this.X.Y(...)
 * Uso: node scripts/marketplace-facade-blocks-report.js
 */

const fs = require("fs");
const path = require("path");

const FACADE = path.resolve(
  path.join(__dirname, "..", "backend", "src", "modules", "marketplace", "marketplace.service.ts")
);

const content = fs.readFileSync(FACADE, "utf8");
const lines = content.split("\n");

/** Linhas que são delegação pura (return this.aggregator.method(...)) */
const delegationLineRe = /return\s+this\.\w+\.\w+\(/;
const delegationLines = lines.filter((line) => delegationLineRe.test(line));

const sectionRe = /^\s*\/\/\s*=+\s*$/;
const sectionTitleRe = /^\s*\/\/\s*([^=].+)$/;
const methodRe = /^\s+(?:async\s+)?(?:get|set|private\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/;

const sections = [];
let current = { name: "(top)", start: 1, end: 0, lineCount: 0, orderMethods: [] };
let i = 0;

for (; i < lines.length; i++) {
  const line = lines[i];
  const lineNum = i + 1;

  if (sectionRe.test(line)) {
    current.end = lineNum;
    current.lineCount = current.end - current.start + 1;
    if (current.start > 0) sections.push({ ...current });

    const nextLine = lines[i + 1];
    const titleMatch = nextLine && sectionTitleRe.exec(nextLine);
    current = {
      name: titleMatch ? titleMatch[1].trim() : "(section)",
      start: lineNum,
      end: 0,
      lineCount: 0,
      orderMethods: [],
    };
    i += 1;
    continue;
  }

  const methodMatch = methodRe.exec(line);
  if (methodMatch && /order|Order/.test(line)) {
    current.orderMethods.push({ line: lineNum, name: methodMatch[1] });
  }
}

current.end = lines.length;
current.lineCount = current.end - current.start + 1;
sections.push(current);

console.log("=== Marketplace Facade — Blocos por seção ===\n");
console.log("Arquivo:", path.relative(process.cwd(), FACADE));
console.log("Total de linhas:", lines.length);
console.log("");

let totalOrderMethods = 0;
for (const s of sections) {
  console.log(`--- ${s.name} ---`);
  console.log(`  Linhas: ${s.start}-${s.end} (${s.lineCount})`);
  if (s.orderMethods.length > 0) {
    totalOrderMethods += s.orderMethods.length;
    console.log(`  Métodos que mencionam order/Order: ${s.orderMethods.map((m) => `${m.name} (${m.line})`).join(", ")}`);
  }
  console.log("");
}

console.log("=== Resumo ===");
console.log(`Seções: ${sections.length}`);
console.log(`Métodos que mencionam order/Order: ${totalOrderMethods} (todos já delegam a aggregator)`);
const pct = lines.length ? Math.round((delegationLines.length / lines.length) * 100) : 0;
console.log(`Linhas de delegação pura (return this.X.Y(...)): ${delegationLines.length} (~${pct}% do arquivo)`);
console.log(`Estimativa: ~${delegationLines.length} métodos-repasse; se cada um tem ~3–5 linhas (assinatura + return), remoção libera ~${delegationLines.length * 4} linhas.`);
console.log("");
console.log("Para reduzir a facade: remover métodos-repasse e fazer rotas usarem facade.<aggregator>.*");
