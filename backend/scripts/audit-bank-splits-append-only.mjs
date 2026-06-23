#!/usr/bin/env node
// Guard estrutural — SPLIT-01 (bank_splits append-only). Simetria com bank_ledger.
//
// Prova que a migration cria a função + os 2 triggers (no_update/no_delete) e que NENHUM código de runtime
// vivo (src/, pós comment-strip) faz UPDATE/DELETE/TRUNCATE em bank_splits. O runtime só faz INSERT
// (bankSplitRepository.createSplit); correções = transação de adjustment/reversal (insere), nunca muta.
//
// MORDE se: a migration perder a função ou um dos triggers; surgir UPDATE bank_splits / DELETE FROM bank_splits
// / TRUNCATE bank_splits em src vivo. (migrations/ históricas NÃO são varridas — backfill one-time é DDL aplicado.)

import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const rel = (p) => p.slice(ROOT.length + 1).replace(/\\/g, '/');
const fails = [];

// ── migration: função + 2 triggers ──
const MIG = 'migrations/20260623120000_bank_splits_append_only.sql';
const mig = existsSync(join(ROOT, MIG)) ? readFileSync(join(ROOT, MIG), 'utf-8') : null;
if (mig === null) fails.push(`migration ausente: ${MIG}`);
else {
  if (!/CREATE OR REPLACE FUNCTION prevent_bank_splits_modification/i.test(mig)) fails.push(`${MIG}: função prevent_bank_splits_modification ausente.`);
  if (!/RAISE EXCEPTION[^\n]*append-only/i.test(mig)) fails.push(`${MIG}: RAISE EXCEPTION append-only ausente.`);
  if (!/CREATE TRIGGER bank_splits_no_update[\s\S]*BEFORE UPDATE ON bank_splits/i.test(mig)) fails.push(`${MIG}: trigger bank_splits_no_update (BEFORE UPDATE) ausente.`);
  if (!/CREATE TRIGGER bank_splits_no_delete[\s\S]*BEFORE DELETE ON bank_splits/i.test(mig)) fails.push(`${MIG}: trigger bank_splits_no_delete (BEFORE DELETE) ausente.`);
}

// ── runtime vivo (src/): zero UPDATE/DELETE/TRUNCATE em bank_splits ──
const MUT = [
  { re: /UPDATE\s+bank_splits\b/i, what: 'UPDATE bank_splits' },
  { re: /DELETE\s+FROM\s+bank_splits\b/i, what: 'DELETE FROM bank_splits' },
  { re: /TRUNCATE\s+(TABLE\s+)?bank_splits\b/i, what: 'TRUNCATE bank_splits' },
];
function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) { if (e !== 'node_modules') walk(p, acc); }
    else if (e.endsWith('.ts')) acc.push(p);
  }
  return acc;
}
// allowlist: o próprio E2E que PROVA o bloqueio tenta UPDATE/DELETE e espera a exception append-only.
const ALLOWED_MUTATION = new Set([
  'src/scripts/e2e-bank-splits-append-only.ts',
]);
for (const abs of walk(join(ROOT, 'src'))) {
  const r = rel(abs);
  if (ALLOWED_MUTATION.has(r)) continue;
  const s = stripTs(readFileSync(abs, 'utf-8'));
  for (const m of MUT) {
    if (m.re.test(s)) fails.push(`${r}: ${m.what} em runtime vivo — bank_splits é append-only (SPLIT-01). Use transação de adjustment/reversal (INSERT), nunca mutação.`);
  }
}

if (fails.length > 0) {
  console.error('GATE FAIL [bank-splits-append-only]:');
  for (const f of fails) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [bank-splits-append-only] — migration cria prevent_bank_splits_modification + triggers no_update/no_delete; nenhum runtime vivo faz UPDATE/DELETE/TRUNCATE em bank_splits (só INSERT). Simetria com bank_ledger.');
