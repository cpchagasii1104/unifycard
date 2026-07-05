#!/usr/bin/env node
// Guard estrutural — F-HELPERS-DUAL-IMPLEMENTATION-DRIFT (Onda 1 zeragem de DT, 2026-07-05).
// `core/db.ts::runQueryWithTenant` era uma implementação PRÓPRIA duplicada de `core/database/
// pool.ts::runQueryWithTenant` — mesma lógica de set_config copiada à mão, sem a sanitização
// undefined→null nem o log estruturado de erro que pool.ts tem. Fix: db.ts agora DELEGA pra
// pool.ts (mesmo padrão que runQueriesWithTenant já usava) — os 44 callers de @core/db ganham as
// duas proteções sem mudar import nenhum. MORDE se db.ts voltar a ter `client.connect()` +
// `set_config` própria dentro de runQueryWithTenant (duplicação reintroduzida).
// Em validate:regression-guards. Heurística textual comment-stripped. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const FILE = join(ROOT, 'src', 'core', 'db.ts');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
if (!existsSync(FILE)) {
  failures.push(`arquivo ausente: ${FILE}`);
} else {
  const src = stripTs(readFileSync(FILE, 'utf8'));
  const idx = src.indexOf('export async function runQueryWithTenant');
  if (idx < 0) {
    failures.push(`${FILE}: runQueryWithTenant não encontrado.`);
  } else {
    const body = src.slice(idx, idx + 300);
    if (!/rawRunQueryWithTenant/.test(body)) {
      failures.push(`${FILE}: runQueryWithTenant não delega mais pra rawRunQueryWithTenant (pool.ts) — duplicação reintroduzida.`);
    }
    if (/set_config/.test(body)) {
      failures.push(`${FILE}: runQueryWithTenant voltou a ter set_config própria — reabre DT-HELPERS-DUAL-IMPLEMENTATION-DRIFT.`);
    }
  }
  if (!/runQueryWithTenant as rawRunQueryWithTenant/.test(src)) {
    failures.push(`${FILE}: import de runQueryWithTenant de '@core/database/pool' ausente.`);
  }
}

if (failures.length) {
  console.error('GATE FAIL [helpers-dual-implementation-unified]:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('GATE OK [helpers-dual-implementation-unified] — core/db.ts::runQueryWithTenant delega pra pool.ts (mesma implementação, sanitização+log incluídos); duplicação não reapareceu.');
