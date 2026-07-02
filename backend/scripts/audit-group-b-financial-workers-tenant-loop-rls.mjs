#!/usr/bin/env node
// Guard estrutural — F-GROUP-B-FINANCIAL-WORKERS-TENANT-LOOP-RLS (DECISION-0149 materializada
// para os 4 workers financeiros ATIVOS; fecha o remanescente da varredura do achado B3).
//
// Os 4 workers (governance-funding, governance-financial-action, treasury-distribution,
// treasury-split) claimavam pendências CROSS-TENANT via pool cru — incompatível com RLS e contra
// a DECISION-0149 (tenant-loop é o padrão canônico; sem bypass global). Convertidos: discovery de
// tenants por fonte NÃO-RLS (tenant-loop.ts) + claim POR TENANT com tenant-context. As 6 tabelas
// (governance_funding, governance_financial_actions, treasury_distributions, treasury_split_config,
// treasury_split_executions, treasury_accounts) ganharam RLS+FORCE em 20260702170000. O cheque de
// idempotência do split (hasExecutionForSettlement) foi re-keyado com tenantId — com pool cru sob
// RLS retornaria vazio e QUEBRARIA a proteção anti-split-duplo.
//
// MORDE:
//   (A) migration 20260702170000 sumir ou perder tabela/ENABLE/FORCE/policy;
//   (B) qualquer worker dos 4 voltar a claimar sem tenant-loop (perder o import de
//       listTenantIdsForWorkerLoop);
//   (C) claim/list de repositório do Grupo B voltar a ser cross-tenant (query de pendência sem
//       filtro de tenant_id);
//   (D) hasExecutionForSettlement perder o tenantId (voltar à assinatura de 1 argumento).
// Heurística textual comment-stripped. Em validate:regression-guards. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const stripSql = (s) => s.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');

const failures = [];

// (A) migration com as 6 tabelas.
const MIGRATION = join(ROOT, 'migrations', '20260702170000_group_b_financial_tables_rls_tenant_loop.sql');
const TABLES = [
  'governance_funding', 'governance_financial_actions', 'treasury_distributions',
  'treasury_split_config', 'treasury_split_executions', 'treasury_accounts',
];
if (!existsSync(MIGRATION)) {
  failures.push(`migration ausente: ${MIGRATION} — RLS do Grupo B reaberto.`);
} else {
  const sql = stripSql(readFileSync(MIGRATION, 'utf-8'));
  for (const tbl of TABLES) {
    if (!sql.includes(`'${tbl}'`)) failures.push(`${MIGRATION}: tabela ${tbl} ausente.`);
  }
  if (!sql.includes('ENABLE ROW LEVEL SECURITY')) failures.push(`${MIGRATION}: ENABLE ROW LEVEL SECURITY ausente.`);
  if (!sql.includes('FORCE ROW LEVEL SECURITY')) failures.push(`${MIGRATION}: FORCE ROW LEVEL SECURITY ausente.`);
  if (!sql.includes('app.current_tenant')) failures.push(`${MIGRATION}: policy não referencia app.current_tenant.`);
}

// (B) workers em tenant-loop.
const WORKERS = [
  'src/workers/governance-funding-worker.ts',
  'src/workers/governance-financial-action-worker.ts',
  'src/workers/treasury-distribution-worker.ts',
  'src/workers/treasury-split-worker.ts',
];
for (const w of WORKERS) {
  const p = join(ROOT, w);
  if (!existsSync(p)) { failures.push(`worker ausente: ${p}`); continue; }
  const src = stripTs(readFileSync(p, 'utf-8'));
  if (!src.includes('listTenantIdsForWorkerLoop')) {
    failures.push(`${w}: não usa listTenantIdsForWorkerLoop — worker voltou a claim cross-tenant (viola DECISION-0149).`);
  }
  if (/pool\.connect\(\)/.test(src)) {
    failures.push(`${w}: pool.connect() cru reapareceu — client de worker deve vir de getClientWithTenant no tenant-loop.`);
  }
}

// (C) claims/list tenant-scoped nos repositórios.
const REPO_CHECKS = [
  {
    file: 'src/modules/governance-funding/governance-funding.repository.ts',
    mustContain: [`status = 'pending' AND tenant_id =`],
    mustNotMatch: [/export async function listPendingFundingRequests/],
  },
  {
    file: 'src/modules/governance/governance-financial-action-repository.ts',
    mustContain: [`status = 'pending' AND tenant_id = $1`],
    mustNotMatch: [/pool\.query/],
  },
  {
    file: 'src/modules/treasury/treasury-distribution-repository.ts',
    mustContain: [`status = 'pending' AND tenant_id = $2`],
    mustNotMatch: [/export async function listPendingDistributions/, /pool\.query/],
  },
  {
    file: 'src/modules/treasury-split/treasury-split-config.repository.ts',
    mustContain: [`e.id IS NULL AND s.tenant_id = $2`],
    mustNotMatch: [/export async function listSettlementsPendingSplit/, /pool\.query/],
  },
  {
    file: 'src/modules/treasury/treasury-account-repository.ts',
    mustContain: [],
    mustNotMatch: [/tenantId\?:/, /pool\.query/],
  },
];
for (const check of REPO_CHECKS) {
  const p = join(ROOT, check.file);
  if (!existsSync(p)) { failures.push(`repositório ausente: ${p}`); continue; }
  const src = stripTs(readFileSync(p, 'utf-8'));
  for (const needle of check.mustContain) {
    if (!src.includes(needle)) failures.push(`${check.file}: filtro tenant-scoped ausente ("${needle}").`);
  }
  for (const bad of check.mustNotMatch) {
    if (bad.test(src)) failures.push(`${check.file}: padrão cross-tenant/proibido reapareceu (${bad}).`);
  }
}

// (D) idempotência do split tenant-scoped.
const SPLIT_REPO = join(ROOT, 'src', 'modules', 'treasury-split', 'treasury-split-config.repository.ts');
if (existsSync(SPLIT_REPO)) {
  const src = stripTs(readFileSync(SPLIT_REPO, 'utf-8'));
  if (!/hasExecutionForSettlement\(\s*\n?\s*tenantId: string,\s*\n?\s*settlementId: string/.test(src.replace(/\r/g, ''))) {
    failures.push(`${SPLIT_REPO}: hasExecutionForSettlement sem tenantId como 1º argumento — cheque de idempotência do split voltaria a ficar cego sob RLS (anti-split-duplo quebrado).`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [group-b-financial-workers-tenant-loop-rls]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [group-b-financial-workers-tenant-loop-rls] — 4 workers financeiros ativos em tenant-loop (DECISION-0149); claims/idempotência tenant-scoped; RLS+FORCE nas 6 tabelas do Grupo B. Achado B3 do auditoria.md: 23/25 tabelas fechadas (3 restantes = config global sem tenant_id, correto).');
