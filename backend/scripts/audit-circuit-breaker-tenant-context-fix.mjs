#!/usr/bin/env node
// Guard estrutural — DT-CIRCUIT-BREAKER-RAW-POOL-QUERY-FAIL-OPEN-UNDER-RLS (achado A3 da
// re-auditoria adversarial de 2026-07-02, corrigido na frente D_FIX da Onda 2, 2026-07-05).
//
// isBreakerActive lia financial_circuit_breakers via pool.query cru, sem tenant-context. A
// tabela tem RLS+FORCE — sob role restrito, a leitura sempre retornaria 0 linhas, fazendo o
// caller interpretar "sem breaker ativo" mesmo com um ativo (fail-open perigoso: pagamentos/
// payouts não pausariam quando deveriam). Corrigido pra runQueryWithTenant.
//
// MORDE se isBreakerActive voltar a usar pool.query cru. Heurística textual comment-stripped.
// Em validate:regression-guards. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const FILE = join(ROOT, 'src', 'modules', 'circuit-breaker', 'financial-circuit-breaker-repository.ts');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
if (!existsSync(FILE)) {
  failures.push(`arquivo ausente: ${FILE}`);
} else {
  const src = stripTs(readFileSync(FILE, 'utf8'));
  const fnStart = src.indexOf('export async function isBreakerActive');
  const fnBody = fnStart >= 0 ? src.slice(fnStart, fnStart + 500) : '';
  if (!fnBody) {
    failures.push(`${FILE}: isBreakerActive não encontrado.`);
  } else {
    if (!/runQueryWithTenant/.test(fnBody)) {
      failures.push(`${FILE}: isBreakerActive não usa runQueryWithTenant — reabre fail-open sob RLS.`);
    }
    if (/\bpool\.query\(/.test(fnBody)) {
      failures.push(`${FILE}: isBreakerActive voltou a usar pool.query cru — reabre DT-CIRCUIT-BREAKER-RAW-POOL-QUERY-FAIL-OPEN-UNDER-RLS.`);
    }
  }
}

if (failures.length) {
  console.error('GATE FAIL [circuit-breaker-tenant-context-fix]:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('GATE OK [circuit-breaker-tenant-context-fix] — isBreakerActive usa runQueryWithTenant (tenant-context real sob RLS); fail-open silencioso não reapareceu.');
