#!/usr/bin/env node
// Guard estrutural — F-PAYOUT-APPROVE-ENDPOINT-CORE-AUTHORITY / CAMINHO B (DECISION-0129).
//
// O endpoint de decisão de payout (src/modules/payout/payout-decision.routes.ts) é FAIL-CLOSED:
// resolve request/approval, valida tenant/tipo/estado, exige requester != approver (D3) e então
// retorna PAYOUT_APPROVAL_POLICY_NOT_CONFIGURED (política/faixa material ausente — D2/D4/D6).
// NÃO aprova, NÃO executa, NÃO move dinheiro. FALHA (exit 1) se a ROTA:
//   (a) chamar approveActorWalletPayout / executeActorWalletPayout / recordFinancialApprovalDecision /
//       worker (start/run...PayoutWorker) / bankTransactionService; ou escrever bank_*/approval_* direto;
//   (b) retornar executed:true;
//   (c) usar availableBalanceCents / seller_available / seller_payout / payout_requests legado;
//   (d) usar businessAuthorizationService / organization_members / company_users / tenant_operator_grants /
//       can_execute_ / can_approve_ / financial:execute_payout / financial:approve_payout como autoridade;
//   (e) ler canal de ator client-declared (req.body actorId / x-actor-id / req.query actorId / actionContext /
//       params.actorId) OU aceitar approvedByUserId/tenantId/status/operationType/approvalRequestId do body;
//   (f) FALTAR: resolvePayoutApprovalPolicy + policy.configured + PAYOUT_APPROVER_CANNOT_BE_REQUESTER +
//       requested_by_user_id + findApprovalRequestById (Core) + executed:false + subject/tenant server-side;
// ou se o RESOLVEDOR de política (payout-approval-policy.ts) deixar de ser fail-closed (sem
// PAYOUT_APPROVAL_POLICY_NOT_CONFIGURED, ou passar a retornar `configured: true`, ou ler grant/saldo);
// ou se as rotas antigas deixarem de ser fail-closed; ou se o baseline 0113 regredir.
// Integrado em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { BASELINE, SAFE_SUBJECT_READERS } from './audit-actor-authority-boundary.mjs';

const ROOT = process.cwd();
const ROUTE = join(ROOT, 'src', 'modules', 'payout', 'payout-decision.routes.ts');
const POLICY = join(ROOT, 'src', 'modules', 'payout', 'payout-approval-policy.ts');
const MODULE = join(ROOT, 'src', 'modules', 'payout', 'payout.module.ts');
const OLD = join(ROOT, 'src', 'modules', 'payout', 'payout.routes.ts');
const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

function runGuard() {
  const failures = [];

  if (!existsSync(ROUTE)) {
    console.error('GATE FAIL [payout-approve-endpoint]: payout-decision.routes.ts ausente.');
    process.exit(1);
  }
  if (!existsSync(POLICY)) {
    console.error('GATE FAIL [payout-approve-endpoint]: payout-approval-policy.ts ausente.');
    process.exit(1);
  }
  const code = stripComments(readFileSync(ROUTE, 'utf8'));
  const policy = stripComments(readFileSync(POLICY, 'utf8'));

  // (a) sem aprovação real / execução / worker / Bank
  for (const sym of [
    'approveActorWalletPayout', 'executeActorWalletPayout', 'recordFinancialApprovalDecision',
    'runActorWalletPayoutWorkerCycle', 'startActorWalletPayoutWorker', 'bankTransactionService',
  ]) {
    if (new RegExp(`\\b${sym}\\b`).test(code)) {
      failures.push(`rota de decisão referencia ${sym} — proibido em CAMINHO B (não aprova/executa/move dinheiro).`);
    }
  }
  if (/(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+bank_[a-z_]+/i.test(code)) failures.push('rota escreve bank_* direto — proibido.');
  if (/(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+approval_[a-z_]+/i.test(code)) failures.push('rota escreve approval_* por SQL cru — proibido (use o Core).');

  // (b) executed:true
  if (/executed\s*:\s*true/.test(code)) failures.push('rota retorna executed:true — fail-closed deve ser executed:false.');

  // (c) legado/projeção como autoridade
  if (/availableBalanceCents/.test(code)) failures.push('rota referencia availableBalanceCents (não autoriza).');
  if (/seller_available|seller_payout/.test(code)) failures.push('rota referencia seller_available/seller_payout (legado).');
  if (/\bpayout_requests\b/.test(code)) failures.push('rota referencia payout_requests legado.');

  // (d) autoridade proibida
  for (const bad of ['businessAuthorizationService', 'organization_members', 'company_users', 'tenant_operator_grants', 'can_execute_', 'can_approve_']) {
    if (new RegExp(bad).test(code)) failures.push(`rota usa autoridade proibida: ${bad}.`);
  }
  if (/financial:(execute|approve)_payout/.test(code)) failures.push('rota usa financial:execute_payout/financial:approve_payout como autoridade.');

  // (e) canal client-declared / spoof de body
  if (/req\.body\??\.(actorId|actor_id)\b|req\.body\??\.actor\b(?!_)|['"]x-actor-id['"]|req\.query[^;]*actorId|req\.actionContext|req\.params\??\.actorId\b/.test(code)) {
    failures.push('rota lê canal de ator client-declared (body/x-actor-id/query/actionContext/params.actorId).');
  }
  if (/req\.body[^;]*\b(approvedByUserId|tenantId|tenant_id|operationType|operation_type|approvalRequestId)\b/.test(code)) {
    failures.push('rota aceita approvedByUserId/tenantId/operationType/approvalRequestId do body como autoridade.');
  }

  // (f) invariantes fail-closed presentes
  const required = [
    { re: /\bresolvePayoutApprovalPolicy\s*\(/, msg: 'rota não consulta resolvePayoutApprovalPolicy (política fail-closed).' },
    { re: /policy\.code/, msg: 'rota não ramifica/usa policy.code (resultado do resolvedor de política).' },
    { re: /PAYOUT_APPROVAL_POLICY_NOT_CONFIGURED/, msg: 'rota não devolve PAYOUT_APPROVAL_POLICY_NOT_CONFIGURED (fail-closed).' },
    { re: /PAYOUT_APPROVER_CANNOT_BE_REQUESTER/, msg: 'rota não enforça requester != approver (PAYOUT_APPROVER_CANNOT_BE_REQUESTER).' },
    { re: /requested_by_user_id/, msg: 'rota não compara requested_by_user_id (segregação de função).' },
    { re: /\bfindApprovalRequestById\s*\(/, msg: 'rota não resolve approval via Core (findApprovalRequestById).' },
    { re: /executed\s*:\s*false/, msg: 'rota não devolve executed:false.' },
    { re: /req\.user\??\.id/, msg: 'subject (aprovador) não vem de req.user server-side.' },
    { re: /req\.tenant\??\.id/, msg: 'tenant não vem de req.tenant server-side.' },
  ];
  for (const r of required) if (!r.re.test(code)) failures.push(r.msg);

  // (policy) resolvedor fail-closed
  if (!/PAYOUT_APPROVAL_POLICY_NOT_CONFIGURED/.test(policy)) {
    failures.push('payout-approval-policy.ts não expõe PAYOUT_APPROVAL_POLICY_NOT_CONFIGURED.');
  }
  if (!/configured:\s*false/.test(policy)) {
    failures.push('payout-approval-policy.ts não produz configured:false (deixou de ser fail-closed).');
  }
  if (/return\s*{[^}]*configured:\s*true/.test(policy)) {
    failures.push('payout-approval-policy.ts RETORNA configured:true — CAMINHO A exige DECISION/faixa material (proibido fabricar aqui).');
  }
  for (const bad of ['availableBalanceCents', 'company_users', 'tenant_operator_grants', 'seller_available', 'can_execute_', 'can_approve_']) {
    if (new RegExp(bad).test(policy)) failures.push(`payout-approval-policy.ts referencia ${bad} — não pode virar autoridade.`);
  }

  // (module) rota registrada
  if (existsSync(MODULE)) {
    const mod = stripComments(readFileSync(MODULE, 'utf8'));
    if (!/payoutDecisionRoutes/.test(mod)) failures.push('payout.module.ts não registra payoutDecisionRoutes.');
  }

  // rotas antigas seguem fail-closed
  if (existsSync(OLD)) {
    const oldc = stripComments(readFileSync(OLD, 'utf8'));
    if ((oldc.match(/PAYOUT_HTTP_EXECUTION_DISABLED/g) || []).length < 1 || (oldc.match(/status\(403\)/g) || []).length < 3) {
      failures.push('rotas antigas (batches/execute-manual/fail) deixaram de ser fail-closed (403).');
    }
  }

  // baseline 0113 íntegro
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
  console.log('[payout-approve-endpoint] POST /payouts/requests/:id/decision: resolvePayoutApprovalPolicy fail-closed (PAYOUT_APPROVAL_POLICY_NOT_CONFIGURED); requester!=approver (PAYOUT_APPROVER_CANNOT_BE_REQUESTER); approval via Core (findApprovalRequestById); executed:false; subject/tenant server-side; sem approve/execute/worker/Bank/recordDecision; sem availableBalanceCents/seller_available/company_users/tenant_operator_grants; resolvedor nunca retorna configured:true; rotas antigas fail-closed; baseline 0113 íntegro.');
  console.log('GATE OK [payout-approve-endpoint] — endpoint de aprovação é FAIL-CLOSED: não aprova sem política Core material, não move dinheiro.');
}

const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMain) runGuard();

export { runGuard };
