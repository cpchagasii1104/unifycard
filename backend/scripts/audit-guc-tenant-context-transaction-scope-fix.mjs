#!/usr/bin/env node
// Guard estrutural — F-GUC-TENANT-CONTEXT-TRANSACTION-SCOPE-FIX.
//
// runQueryWithTenant/runQueriesWithTenant/getClientWithTenant/getClientWithPlatformAdmin setavam
// app.current_tenant/app.is_platform_admin com set_config(...,true) (is_local=true) SEM BEGIN
// explícito — o GUC evaporava antes da query real do caller rodar (transação implícita própria por
// statement em autocommit). Confirmado empiricamente: current_setting() vazio na query seguinte.
// Sob unificard_app (RLS-live, NOSUPERUSER/NOBYPASSRLS), isso fazia qualquer tabela com FORCE ROW
// LEVEL SECURITY retornar 0 linhas via esses helpers — fail-closed, mas quebrado. Invisível em dev
// (DATABASE_URL local conecta como postgres, superuser, sempre bypassa RLS).
//
// MORDE: qualquer um dos 4 set_config voltar a usar is_local=true (terceiro argumento 'true' em vez
// de 'false').
// Heurística textual comment-stripped. Prova REAL (RLS de verdade, role NOSUPERUSER/NOBYPASSRLS) é
// feita pelo E2E (validate-pipeline-e2e-guc-tenant-context-transaction-scope-fix.ts).
// Em validate:regression-guards. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
const POOL = join(ROOT, 'src', 'core', 'database', 'pool.ts');

if (!existsSync(POOL)) {
  failures.push(`arquivo ausente: ${POOL}`);
} else {
  const src = stripTs(readFileSync(POOL, 'utf-8'));
  const badPatterns = [
    /set_config\('app\.current_tenant',\s*\$1,\s*true\)/g,
    /set_config\('app\.is_platform_admin',\s*'true',\s*true\)/g,
  ];
  for (const p of badPatterns) {
    const m = src.match(p);
    if (m) {
      failures.push(`${POOL}: set_config com is_local=true reapareceu — GUC evapora antes da query real do caller sem BEGIN explícito: ${m.join(', ')}`);
    }
  }
  const falseCount = (src.match(/set_config\('app\.current_tenant',\s*\$1,\s*false\)/g) || []).length;
  if (falseCount < 3) {
    failures.push(`${POOL}: esperava 3 ocorrências de set_config('app.current_tenant', $1, false) (getClientWithTenant/runQueryWithTenant/runQueriesWithTenant), achou ${falseCount}.`);
  }
  if (!/set_config\('app\.is_platform_admin',\s*'true',\s*false\)/.test(src)) {
    failures.push(`${POOL}: getClientWithPlatformAdmin não usa set_config(...,false).`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [guc-tenant-context-transaction-scope-fix]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [guc-tenant-context-transaction-scope-fix] — os 4 helpers (getClientWithTenant/getClientWithPlatformAdmin/runQueryWithTenant/runQueriesWithTenant) usam set_config(...,false) — GUC de tenant/admin sobrevive à query real do caller sem exigir BEGIN explícito. Bug de evaporação silenciosa sob RLS blindado.');
