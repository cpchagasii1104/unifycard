#!/usr/bin/env node
/**
 * Gera relatório visual da arquitetura do marketplace (Mermaid → SVG).
 * Só atualiza o SVG quando o dependency-graph é válido (exit 0).
 * Evita regenerar SVG se o grafo não mudou (menos ruído em commits, CI mais rápido).
 * Uso: npm run marketplace:architecture-report
 */

const fs = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs", "architecture");
const OUT_SVG = path.join(OUT_DIR, "marketplace-architecture.svg");
const MMD_PATH = path.join(OUT_DIR, ".marketplace-graph.mmd");

const graphScript = path.join(__dirname, "marketplace-dependency-graph.js");

const result = spawnSync("node", [graphScript], {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 2 * 1024 * 1024,
});

if (result.status !== 0) {
  console.error("[marketplace:architecture-report] Arquitetura inválida; SVG não atualizado.");
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(1);
}

const mermaid = result.stdout.trim();
if (!mermaid || !mermaid.includes("flowchart")) {
  console.error("[marketplace:architecture-report] Saída do grafo inválida.");
  process.exit(1);
}

// Melhoria 2: evitar atualização desnecessária — comparar grafo anterior
fs.mkdirSync(OUT_DIR, { recursive: true });
if (fs.existsSync(MMD_PATH)) {
  const prevRaw = fs.readFileSync(MMD_PATH, "utf8");
  const prevGraph = prevRaw.replace(/^%%[^\n]*\n?/gm, "").trim();
  if (prevGraph === mermaid) {
    console.log("[marketplace:architecture-report] Architecture unchanged; skipping SVG generation.");
    process.exit(0);
  }
}

// Melhoria 3: timestamp arquitetural (auditoria)
const timestamp = new Date().toISOString();
const contentWithMeta = [
  "%% Generated automatically by marketplace:architecture-report",
  "%% Timestamp: " + timestamp,
  "",
  mermaid,
].join("\n");

// Refinamento 1: garantir diretório antes de escrever .mmd (evita erro em CI)
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(MMD_PATH, contentWithMeta, "utf8");

// Melhoria 1: mmdc via devDependency (evita download no CI)
const mmdcCmd = `npx mmdc -i "${MMD_PATH}" -o "${OUT_SVG}"`;
try {
  execSync(mmdcCmd, {
    cwd: ROOT,
    stdio: "inherit",
  });
} catch (e) {
  console.error("[marketplace:architecture-report] Falha ao gerar SVG com mmdc.");
  console.error("[marketplace:architecture-report] Comando: " + mmdcCmd);
  console.error("[marketplace:architecture-report] Execute: npm install");
  console.error("[marketplace:architecture-report] Ou verifique @mermaid-js/mermaid-cli.");
  process.exit(1);
}

console.log("[marketplace:architecture-report] ✅ " + path.relative(ROOT, OUT_SVG));
