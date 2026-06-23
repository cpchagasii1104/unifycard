#!/usr/bin/env node
// Guard estrutural — F-RLS-TENANT-CONTEXT-FIX (modo BASELINE-DRAIN, padrão canal-1 0113).
//
// Tabelas financeiras/identidade têm RLS+FORCE. Sob a role de runtime unificard_app (NOBYPASSRLS), QUALQUER
// `pool.query` CRU (sem app.current_tenant) a essas tabelas retorna 0 linhas → apagão silencioso. Hoje o app
// conecta como postgres (superuser) que MASCARA o bug. O preflight amostrou 3 arquivos; este guard exaustivo
// revelou que o gap é SISTÊMICO. ESTRATÉGIA: BASELINE explícito (backlog de dreno) — o guard MORDE se surgir
// acesso cru NOVO (fora do baseline/allowlist) e NÃO permite um arquivo já drenado regredir.
//
// DRENO: ao converter um arquivo p/ runQueryWithTenant/getClientWithTenant, REMOVA-O do BASELINE. Meta = BASELINE vazio.
// RLS-runtime-live OPS só vira a chave quando BASELINE = 0 (ou decisão de RLS-live escopado às tabelas já drenadas).

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const rel = (p) => p.slice(ROOT.length + 1).replace(/\\/g, '/');

const RAW_NEAR_RLS = /pool\.query[\s\S]{0,280}?(bank_ledger|bank_transactions|bank_splits|bank_accounts|actor_wallet_payout_requests|actor_wallet_recovery_obligation|financial_approval_(policies|authorities|policy_events)|approval_requests|service_payment_executions|b2b_payment_intents|\bactors\b)/;

// Allowlist: NÃO-runtime-tenant-scoped (conexão admin) ou com decisão própria pendente.
const isAllowedPath = (r) =>
  r.startsWith('src/scripts/') ||           // testes/scripts (conexão admin)
  r.includes('/__tests__/') || r.endsWith('.test.ts') || // testes
  r.startsWith('src/workers/') ||           // workers cross-tenant — decisão de conexão (infra vs tenant-loop) pendente
  r === 'src/core/identity/fiscal-identity-kyb.service.ts' || // reviewer-check antes do tenant resolvido — DECISION_REQUIRED
  r === 'src/modules/bank/bank-ledger.repository.ts';        // sumGlobalDebitCreditTotals = admin/backfill (não-runtime)

// BASELINE = backlog de DRENO (runtime tenant-scoped com pool.query cru, ainda NÃO convertido). Encolher até 0.
// (availability-owner-authority + actor-wallet-payout JÁ drenados → NÃO estão aqui; se regredirem, mordem.)
const BASELINE = new Set([
  // CROSS-TENANT (DECISION_REQUIRED — conexão infra vs tenant-loop; NÃO drenar por tenant-context):
  'src/core/observability/ledger-integrity-monitor.ts',     // checkLedgerIntegrity(pool) — soma global bank_ledger (todos tenants)
  'src/modules/reconciliation/reconciliation.repository.ts', // lista DISTINCT tenant_id (sweep cross-tenant)
  // DRENADOS (removidos): Fatia 1 (availability-owner-authority · actor-wallet-payout.service) ·
  //   LOTE 1 (actor-wallet-balance-projection · actor-bank-destination.service · regional-fund-governance · donation.service) ·
  //   LOTE 2 (service-offering.service · media-asset.service · operational-address.helper · profile-education · profile-physical).
  // Restam SÓ os 2 cross-tenant acima → decisão de conexão (infra vs loop) → baseline 0 → RLS-live OPS.
]);

function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) { if (e !== 'node_modules') walk(p, acc); }
    else if (e.endsWith('.ts')) acc.push(p);
  }
  return acc;
}

const fails = [];
const baselineHit = [];
const staleBaseline = new Set(BASELINE);
for (const abs of walk(join(ROOT, 'src'))) {
  const r = rel(abs);
  if (isAllowedPath(r)) continue;
  const s = stripTs(readFileSync(abs, 'utf-8'));
  if (!RAW_NEAR_RLS.test(s)) continue;
  if (BASELINE.has(r)) { baselineHit.push(r); staleBaseline.delete(r); continue; }
  const m = s.match(RAW_NEAR_RLS);
  fails.push(`NOVO acesso cru: ${r}: pool.query perto de tabela RLS '${m[1]}' — runtime tenant-scoped DEVE usar runQueryWithTenant/getClientWithTenant (sob unificard_app retorna 0 linhas). F-RLS-TENANT-CONTEXT-FIX.`);
}
// baseline que não bate mais = arquivo DRENADO → deve sair do BASELINE (mantém o backlog honesto).
for (const r of staleBaseline) fails.push(`BASELINE stale: ${r} não tem mais acesso cru — remova do BASELINE em audit-rls-tenant-context.mjs (dreno concluído).`);

if (fails.length > 0) {
  console.error('GATE FAIL [rls-tenant-context]:');
  for (const f of fails) console.error('   - ' + f);
  process.exit(1);
}
console.log(`GATE OK [rls-tenant-context] — 0 acesso cru NOVO; baseline de dreno = ${baselineHit.length} arquivo(s) runtime ainda com pool.query cru a tabela RLS (backlog rastreado; RLS-live OPS só com baseline=0 ou RLS-live escopado). Allowlist: scripts/__tests__/workers (admin/decisão) + fiscal-identity-kyb + bank-ledger admin.`);
