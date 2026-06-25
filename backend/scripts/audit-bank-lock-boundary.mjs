#!/usr/bin/env node
// Gate estrutural — F-BANK-LOCK-BOUNDARY (LEI §4.7).
// Complementa audit-bank-ledger-boundaries (que cobre ESCRITA INSERT/UPDATE bank_*). Aqui: o LOCK FÍSICO
//   `SELECT … FROM bank_* … FOR UPDATE`  só pode viver DENTRO do domínio Bank. Módulo externo deve PEDIR o
//   lock a um método canônico do Bank, nunca travar `bank_*` inline. Heurística textual (multiline), não AST.
// Integrado em validate:regression-guards.

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const SRC = join(process.cwd(), 'src');
const ALLOWED_DIRS = ['modules/bank/', 'modules/bank-settlement/'];
// `FROM bank_<tabela> … FOR UPDATE` (mesma query, multiline) — lock físico de bank_*.
const LOCK_PATTERN = /FROM\s+bank_(transactions|ledger|accounts|splits)\b[\s\S]{0,400}?FOR\s+UPDATE/i;

const failures = [];
let scanned = 0;

function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) { if (e !== 'node_modules') walk(p, acc); }
    else if (e.endsWith('.ts')) acc.push(p);
  }
  return acc;
}

for (const file of walk(SRC)) {
  const rel = file.replace(SRC, '').replace(/\\/g, '/').replace(/^\//, '');
  if (rel.startsWith('scripts/') || rel.includes('.test.')) continue;
  if (ALLOWED_DIRS.some((d) => rel.includes(d))) continue;
  scanned++;
  const content = readFileSync(file, 'utf-8');
  if (LOCK_PATTERN.test(content)) {
    failures.push(
      `BANK_LOCK_BOUNDARY: ${rel} faz lock físico (FROM bank_* … FOR UPDATE) FORA do domínio Bank (§4.7). ` +
      'Mova o lock para um método canônico em modules/bank/ (ex.: bankTransactionService.lockTransactionByReferenceForSettlement) ' +
      'e chame-o; módulo externo não trava bank_* inline.'
    );
  }
}

console.log(`[bank-lock-boundary] scanned=${scanned} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [bank-lock-boundary]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [bank-lock-boundary] — nenhum FOR UPDATE em bank_* fora do domínio Bank; o cofre só é travado pelo Bank (§4.7).');
