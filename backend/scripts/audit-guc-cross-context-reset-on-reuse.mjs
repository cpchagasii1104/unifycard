#!/usr/bin/env node
// Guard estrutural — F-GUC-CROSS-CONTEXT-RESET-ON-REUSE-FIX (achado A1 da re-auditoria
// adversarial de 2026-07-02 sobre F-GUC-TENANT-CONTEXT-TRANSACTION-SCOPE-FIX).
//
// is_local=false sozinho não bastava: o GUC de sessão sobrevive ao client.release() e o pool
// REUTILIZA a mesma conexão física pro próximo caller (pool.on('connect') só roda em conexão
// NOVA). Setar só app.current_tenant deixava app.is_platform_admin com valor STALE de um uso
// anterior da mesma conexão — se essa conexão tivesse servido getClientWithPlatformAdmin antes,
// o tenant seguinte herdaria o bypass de admin (vazamento cross-tenant real em
// canonical_services). Fix: toda chamada reseta os DOIS GUCs num único round-trip.
//
// MORDE: qualquer um dos 4 helpers de pool.ts, ou runQueryWithTenant de core/db.ts, voltar a
// setar SÓ um GUC sem resetar o outro. Heurística textual comment-stripped. Prova REAL (reuso
// de conexão forçado, RLS de verdade) é feita pelo E2E
// (validate-pipeline-e2e-guc-cross-context-reset-on-reuse.ts). Em validate:regression-guards.
// NÃO altera runtime.

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
  const bothCount = (src.match(/set_config\('app\.current_tenant',\s*\$1,\s*false\),\s*set_config\('app\.is_platform_admin',\s*'false',\s*false\)/g) || []).length;
  if (bothCount < 3) {
    failures.push(`${POOL}: esperava 3 ocorrências de reset duplo em getClientWithTenant/runQueryWithTenant/runQueriesWithTenant, achou ${bothCount}.`);
  }
  // getClientWithPlatformAdmin reseta is_platform_admin='true' + current_tenant via
  // NO_TENANT_SENTINEL (nil-UUID cast-safe, achado N2). Aceita a forma parametrizada ($1 =
  // NO_TENANT_SENTINEL) e rejeita o retorno ao literal '' (que estoura ''::uuid nas policies ::uuid).
  if (!/set_config\('app\.is_platform_admin',\s*'true',\s*false\),\s*set_config\('app\.current_tenant',\s*\$1,\s*false\)/.test(src)) {
    failures.push(`${POOL}: getClientWithPlatformAdmin não reseta app.current_tenant (esperado via NO_TENANT_SENTINEL nil-UUID).`);
  }
  if (/set_config\('app\.current_tenant',\s*''/.test(src)) {
    failures.push(`${POOL}: reset de current_tenant com '' reapareceu — ''::uuid estoura 22P02 em policies com CAST ::uuid (achado N2); usar NO_TENANT_SENTINEL nil-UUID.`);
  }
  if (!/NO_TENANT_SENTINEL\s*=\s*'00000000-0000-0000-0000-000000000000'/.test(src)) {
    failures.push(`${POOL}: NO_TENANT_SENTINEL (nil-UUID) ausente ou alterado — sentinel cast-safe do reset admin (achado N2).`);
  }
}

const DB_TS = join(ROOT, 'src', 'core', 'db.ts');
if (!existsSync(DB_TS)) {
  failures.push(`arquivo ausente: ${DB_TS}`);
} else {
  const src = stripTs(readFileSync(DB_TS, 'utf-8'));
  // Escopo: só a função runQueryWithTenant (única com o bug — runTenantTransaction/
  // runTenantTransactionWithClient usam is_local=true CORRETAMENTE, sempre após BEGIN).
  const fnStart = src.indexOf('export async function runQueryWithTenant');
  const fnEnd = src.indexOf('\nexport async function runQueriesWithTenant', fnStart);
  const fnBody = fnStart >= 0 && fnEnd > fnStart ? src.slice(fnStart, fnEnd) : '';
  if (!fnBody) {
    failures.push(`${DB_TS}: não achei o corpo de runQueryWithTenant para verificar.`);
  } else {
    if (/set_config\('app\.current_tenant',\s*\$1,\s*true\)/.test(fnBody)) {
      failures.push(`${DB_TS}: runQueryWithTenant voltou a usar is_local=true sem BEGIN (mesmo bug de F-GUC-TENANT-CONTEXT-TRANSACTION-SCOPE-FIX, achado A2 da re-auditoria).`);
    }
    if (!/set_config\('app\.current_tenant',\s*\$1,\s*false\),\s*set_config\('app\.is_platform_admin',\s*'false',\s*false\)/.test(fnBody)) {
      failures.push(`${DB_TS}: runQueryWithTenant não reseta app.is_platform_admin.`);
    }
  }
}

// (N1) financial-audit.ts::recordFinancialAudit escreve financial_audit_trail (RLS+FORCE desde
// 20260702160000) via tenant-context, NÃO pool cru — senão o WITH CHECK rejeita a trilha sob
// unificard_app e a auditoria financeira para silenciosamente.
const FIN_AUDIT = join(ROOT, 'src', 'core', 'observability', 'financial-audit.ts');
if (!existsSync(FIN_AUDIT)) {
  failures.push(`arquivo ausente: ${FIN_AUDIT}`);
} else {
  const src = stripTs(readFileSync(FIN_AUDIT, 'utf-8'));
  if (/\bpool\.query\(|\bpool\.connect\(/.test(src)) {
    failures.push(`${FIN_AUDIT}: recordFinancialAudit usa pool cru — sob RLS o INSERT em financial_audit_trail é rejeitado e a trilha de auditoria para silenciosa (achado N1). Usar runQueryWithTenant.`);
  }
  if (!/runQueryWithTenant\(/.test(src)) {
    failures.push(`${FIN_AUDIT}: recordFinancialAudit não usa runQueryWithTenant — trilha de auditoria não é tenant-scoped (achado N1).`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [guc-cross-context-reset-on-reuse]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [guc-cross-context-reset-on-reuse] — os 4 helpers de pool.ts + core/db.ts::runQueryWithTenant resetam AMBOS os GUCs (current_tenant nil-UUID cast-safe / is_platform_admin) em toda chamada; recordFinancialAudit tenant-scoped. Achados A1+A2 + N1+N2 da re-auditoria blindados.');
