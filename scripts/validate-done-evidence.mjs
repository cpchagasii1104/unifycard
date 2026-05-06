#!/usr/bin/env node
/**
 * Toda linha EXEC-* com State=DONE deve ter Evidence não vazio e não placeholder.
 * Uso: node scripts/validate-done-evidence.mjs
 */
import { parseExecRegistry } from './execution-guard/parse-exec-registry.mjs';

const { rows, foundSection } = parseExecRegistry();

if (!foundSection || rows.length === 0) {
  console.log('[done-evidence] SKIP (sem registo EXEC)');
  process.exit(0);
}

const norm = (s) => s.trim().toUpperCase();
const BAD = new Set(['', '—', '-', '…', '...', 'N/A', 'NA', 'TBD', 'TODO', 'PENDENTE']);

function isWeakEvidence(ev) {
  const t = ev.trim();
  if (BAD.has(t) || BAD.has(norm(t))) return true;
  if (t.length < 8) return true;
  return false;
}

let ok = true;
for (const r of rows) {
  if (norm(r.state) !== 'DONE') continue;
  if (isWeakEvidence(r.evidence)) {
    console.error(`[done-evidence] FAIL: ${r.task} está DONE mas Evidence inválida ou curta demais: "${r.evidence}"`);
    ok = false;
  }
}

if (!ok) process.exit(1);
console.log('[done-evidence] PASS');
process.exit(0);
