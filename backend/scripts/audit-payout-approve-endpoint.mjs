#!/usr/bin/env node
// Guard estrutural — F-PAYOUT-APPROVAL-POLICY-MATERIALIZATION (DECISION-0130).
//
// O endpoint de decisão de payout aprova DENTRO da faixa MVP via Core Financeiro material (policy +
// authority do operador + travas D7 + limite diário), registrando a decisão append-only e mudando
// approval/payout para 'approved' — SEM mover dinheiro (executed:false). Arquitetura:
//   ROUTE   src/modules/payout/payout-decision.routes.ts      (pré-checagens + delega ao orquestrador)
//   ORCH    src/modules/payout/payout-approval.service.ts     (decisão Core + bridge selado)
//   CORE    src/core/financial-approval/payout-approval-policy.service.ts  (policy/authority/D7/diário/evento)
//   CONST   src/core/financial-approval/payout-approval-policy.constants.ts (faixa MVP 50000/150000)
//
// FALHA (exit 1) se:
//  (ROUTE) chamar approveActorWalletPayout/executeActorWalletPayout/recordFinancialApprovalDecision/worker/
//          bankTransactionService; escrever bank_*/approval_*; retornar executed:true; usar availableBalanceCents/
//          seller_available/payout_requests/company_users/tenant_operator_grants/organization_members/
//          businessAuthorizationService/can_execute_/can_approve_/financial:(execute|approve)_payout; ler canal
//          client-declared ou aceitar spoof de body; ou FALTAR payoutApprovalService/PAYOUT_APPROVER_CANNOT_BE_
//          REQUESTER/requested_by_user_id/findApprovalRequestById/executed:false/req.user|tenant server-side;
//  (CORE)  NÃO referenciar as 3 tabelas Core (policies/authorities/policy_events), a faixa MVP, o limite diário
//          e as travas D7 (kyc/atl/risk/recovery/internal_settlement); OU usar grant comum/availableBalanceCents/
//          seller_available como autoridade; OU chamar executor/worker/Bank/escrever bank_*;
//  (CONST) faixa MVP divergir de 50000/150000;
//  (ORCH)  não chamar o bridge approveActorWalletPayout ou a decisão Core; OU chamar executor/worker/Bank;
//  rotas antigas deixarem de ser fail-closed; baseline 0113 regredir.
// Integrado em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { BASELINE, SAFE_SUBJECT_READERS } from './audit-actor-authority-boundary.mjs';

const ROOT = process.cwd();
const ROUTE = join(ROOT, 'src', 'modules', 'payout', 'payout-decision.routes.ts');
const ORCH = join(ROOT, 'src', 'modules', 'payout', 'payout-approval.service.ts');
const CORE = join(ROOT, 'src', 'core', 'financial-approval', 'payout-approval-policy.service.ts');
const CONST = join(ROOT, 'src', 'core', 'financial-approval', 'payout-approval-policy.constants.ts');
const MODULE = join(ROOT, 'src', 'modules', 'payout', 'payout.module.ts');
const OLD = join(ROOT, 'src', 'modules', 'payout', 'payout.routes.ts');
const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

function runGuard() {
  const failures = [];
  for (const [label, f] of [['route', ROUTE], ['orchestrator', ORCH], ['core-service', CORE], ['constants', CONST]]) {
    if (!existsSync(f)) {
      console.error(`GATE FAIL [payout-approve-endpoint]: ${label} ausente (${f.replace(ROOT, '')}).`);
      process.exit(1);
    }
  }
  const route = stripComments(readFileSync(ROUTE, 'utf8'));
  const orch = stripComments(readFileSync(ORCH, 'utf8'));
  const core = stripComments(readFileSync(CORE, 'utf8'));
  const constants = stripComments(readFileSync(CONST, 'utf8'));

  // ── ROUTE ───────────────────────────────────────────────────────────────────
  for (const sym of [
    'approveActorWalletPayout', 'executeActorWalletPayout', 'recordFinancialApprovalDecision',
    'runActorWalletPayoutWorkerCycle', 'startActorWalletPayoutWorker', 'bankTransactionService',
  ]) {
    if (new RegExp(`\\b${sym}\\b`).test(route)) failures.push(`ROUTE referencia ${sym} — proibido (a rota delega ao orquestrador; não move dinheiro).`);
  }
  if (/(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(bank_|approval_)[a-z_]+/i.test(route)) failures.push('ROUTE escreve bank_*/approval_* direto — proibido.');
  if (/executed\s*:\s*true/.test(route)) failures.push('ROUTE retorna executed:true — proibido.');
  if (/availableBalanceCents/.test(route)) failures.push('ROUTE referencia availableBalanceCents (não autoriza).');
  if (/seller_available|seller_payout/.test(route)) failures.push('ROUTE referencia seller_available/seller_payout (legado).');
  if (/\bpayout_requests\b/.test(route)) failures.push('ROUTE referencia payout_requests legado.');
  for (const bad of ['businessAuthorizationService', 'organization_members', 'company_users', 'tenant_operator_grants', 'can_execute_', 'can_approve_']) {
    if (new RegExp(bad).test(route)) failures.push(`ROUTE usa autoridade proibida: ${bad}.`);
  }
  if (/financial:(execute|approve)_payout/.test(route)) failures.push('ROUTE usa financial:(execute|approve)_payout como autoridade.');
  if (/req\.body\??\.(actorId|actor_id)\b|req\.body\??\.actor\b(?!_)|['"]x-actor-id['"]|req\.query[^;]*actorId|req\.actionContext|req\.params\??\.actorId\b/.test(route)) {
    failures.push('ROUTE lê canal de ator client-declared (body/x-actor-id/query/actionContext/params.actorId).');
  }
  if (/req\.body[^;]*\b(approvedByUserId|tenantId|tenant_id|operationType|operation_type|approvalRequestId|amountCents|availableBalanceCents)\b/.test(route)) {
    failures.push('ROUTE aceita approvedByUserId/tenantId/operationType/approvalRequestId/amount do body como autoridade.');
  }
  const routeReq = [
    { re: /payoutApprovalService\.approvePayoutDecision\s*\(/, msg: 'ROUTE não delega ao orquestrador material (payoutApprovalService.approvePayoutDecision).' },
    { re: /PAYOUT_APPROVER_CANNOT_BE_REQUESTER/, msg: 'ROUTE não enforça requester != approver (PAYOUT_APPROVER_CANNOT_BE_REQUESTER).' },
    { re: /requested_by_user_id/, msg: 'ROUTE não compara requested_by_user_id (segregação).' },
    { re: /\bfindApprovalRequestById\s*\(/, msg: 'ROUTE não resolve approval via Core (findApprovalRequestById).' },
    { re: /executed\s*:\s*false/, msg: 'ROUTE não devolve executed:false.' },
    { re: /req\.user\??\.id/, msg: 'ROUTE: subject (aprovador) não vem de req.user server-side.' },
    { re: /req\.tenant\??\.id/, msg: 'ROUTE: tenant não vem de req.tenant server-side.' },
  ];
  for (const r of routeReq) if (!r.re.test(route)) failures.push(r.msg);

  // ── CORE SERVICE (material) ───────────────────────────────────────────────────
  const coreReq = [
    { re: /financial_approval_policies/, msg: 'CORE não consulta financial_approval_policies.' },
    { re: /financial_approval_authorities/, msg: 'CORE não consulta financial_approval_authorities (autoridade do operador).' },
    { re: /financial_approval_policy_events/, msg: 'CORE não grava trilha append-only (financial_approval_policy_events).' },
    { re: /PAYOUT_MVP_MAX_AMOUNT_CENTS/, msg: 'CORE não aplica a faixa MVP (PAYOUT_MVP_MAX_AMOUNT_CENTS).' },
    { re: /PAYOUT_APPROVAL_DAILY_LIMIT_EXCEEDED/, msg: 'CORE não enforça o limite diário (PAYOUT_APPROVAL_DAILY_LIMIT_EXCEEDED).' },
    { re: /date_trunc\(\s*'day'/, msg: 'CORE não computa uso diário (date_trunc day).' },
    { re: /atl_blocked_actors/, msg: 'CORE não checa ATL (atl_blocked_actors).' },
    { re: /actor_risk_profile/, msg: 'CORE não checa risco (actor_risk_profile).' },
    { re: /actor_wallet_recovery_obligations/, msg: 'CORE não checa recovery (actor_wallet_recovery_obligations).' },
    { re: /kyc_status/, msg: 'CORE não checa KYC (kyc_status).' },
    { re: /internal_settlement/, msg: 'CORE não checa destino (internal_settlement).' },
    { re: /pg_advisory_xact_lock/, msg: 'CORE não serializa o diário (pg_advisory_xact_lock).' },
  ];
  for (const r of coreReq) if (!r.re.test(core)) failures.push(r.msg);
  for (const bad of ['company_users', 'tenant_operator_grants', 'organization_members', 'availableBalanceCents', 'seller_available', 'can_execute_', 'businessAuthorizationService']) {
    if (new RegExp(bad).test(core)) failures.push(`CORE usa autoridade/sinal proibido: ${bad}.`);
  }
  for (const sym of ['executeActorWalletPayout', 'bankTransactionService', 'startActorWalletPayoutWorker', 'runActorWalletPayoutWorkerCycle']) {
    if (new RegExp(`\\b${sym}\\b`).test(core)) failures.push(`CORE referencia ${sym} — Core decide, não executa/move dinheiro.`);
  }
  if (/(INSERT\s+INTO|UPDATE)\s+bank_[a-z_]+/i.test(core)) failures.push('CORE escreve bank_* direto — proibido.');

  // ── CONSTANTS (faixa MVP ancorada em DECISION-0130 D4) ────────────────────────
  if (!/PAYOUT_MVP_MAX_AMOUNT_CENTS\s*=\s*50000\b/.test(constants)) failures.push('CONST: PAYOUT_MVP_MAX_AMOUNT_CENTS != 50000 (faixa MVP D4).');
  if (!/PAYOUT_MVP_DAILY_LIMIT_CENTS\s*=\s*150000\b/.test(constants)) failures.push('CONST: PAYOUT_MVP_DAILY_LIMIT_CENTS != 150000 (faixa MVP D4).');

  // ── ORCHESTRATOR (decisão Core + bridge; sem execução) ────────────────────────
  if (!/decidePayoutApproval\s*\(/.test(orch)) failures.push('ORCH não chama a decisão material (decidePayoutApproval).');
  if (!/\bapproveActorWalletPayout\s*\(/.test(orch)) failures.push('ORCH não chama o bridge selado (approveActorWalletPayout) no caminho aprovado.');
  for (const sym of ['executeActorWalletPayout', 'bankTransactionService', 'startActorWalletPayoutWorker', 'runActorWalletPayoutWorkerCycle']) {
    if (new RegExp(`\\b${sym}\\b`).test(orch)) failures.push(`ORCH referencia ${sym} — orquestrador não executa/move dinheiro.`);
  }
  if (/(INSERT\s+INTO|UPDATE)\s+bank_[a-z_]+/i.test(orch)) failures.push('ORCH escreve bank_* direto — proibido.');

  // ── módulo registra a rota ─────────────────────────────────────────────────────
  if (existsSync(MODULE)) {
    const mod = stripComments(readFileSync(MODULE, 'utf8'));
    if (!/payoutDecisionRoutes/.test(mod)) failures.push('payout.module.ts não registra payoutDecisionRoutes.');
  }

  // ── rotas antigas fail-closed + baseline 0113 ─────────────────────────────────
  if (existsSync(OLD)) {
    const oldc = stripComments(readFileSync(OLD, 'utf8'));
    if ((oldc.match(/PAYOUT_HTTP_EXECUTION_DISABLED/g) || []).length < 1 || (oldc.match(/status\(403\)/g) || []).length < 3) {
      failures.push('rotas antigas (batches/execute-manual/fail) deixaram de ser fail-closed (403).');
    }
  }
  if ('core/unifybank/bank-http.routes.ts' in BASELINE || 'modules/payout/payout.routes.ts' in BASELINE) {
    failures.push('baseline 0113 regrediu: bank-http/payout voltou ao BASELINE.');
  }
  if (!('modules/payout/payout.routes.ts' in SAFE_SUBJECT_READERS)) {
    failures.push('payout.routes.ts saiu de SAFE_SUBJECT_READERS — regressão.');
  }

  if (failures.length > 0) {
    console.error('GATE FAIL [payout-approve-endpoint]:');
    failures.forEach((x) => console.error(`  ❌ ${x}`));
    process.exit(1);
  }
  console.log('[payout-approve-endpoint] approve material: ROUTE delega payoutApprovalService (requester!=approver, executed:false, sem bridge/execução/grant comum); CORE policy+authority+D7(kyc/atl/recovery/risk/destino)+diário(advisory lock)+evento append-only, faixa MVP 50000/150000; ORCH decisão Core + bridge selado sem execução; rotas antigas fail-closed; baseline 0113 íntegro.');
  console.log('GATE OK [payout-approve-endpoint] — aprovação material dentro da faixa MVP; HTTP nunca executa/move dinheiro.');
}

const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMain) runGuard();

export { runGuard };
