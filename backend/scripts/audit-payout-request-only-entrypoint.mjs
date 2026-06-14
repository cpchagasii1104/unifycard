#!/usr/bin/env node
// Guard estrutural — F-PAYOUT-REQUEST-ONLY-ENTRYPOINT (DECISION-0128).
//
// A entrada HTTP de payout é REQUEST-ONLY: cria solicitação (pending_approval) e NADA mais.
// Alvo: src/modules/payout/payout-request.routes.ts. FALHA (exit 1) se a rota:
//   (a) chamar approveActorWalletPayout / executeActorWalletPayout / worker cycle / bankTransactionService;
//   (b) escrever bank_* direto / retornar executed:true;
//   (c) usar seller_available/seller_payout / payout_requests legado / availableBalanceCents como autoridade;
//   (d) usar businessAuthorizationService / organization_members / can_manage_financial / financial:execute_payout /
//       can_execute_* / actionContext / x-actor-id / query.actorId como subject; ou aceitar requestedByUserId/tenant do body;
//   (e) NÃO usar canRepresentActor / NÃO delegar a requestActorWalletPayout / NÃO devolver executed:false;
//   (f) existir um endpoint de approve/decision em qualquer *.routes.ts de payout;
//   (g) as 3 rotas antigas deixarem de ser fail-closed (PAYOUT_HTTP_EXECUTION_DISABLED);
//   (h) baseline 0113 regredir (payout/bank-http fora de SAFE_SUBJECT_READERS).
// Integrado em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { BASELINE, SAFE_SUBJECT_READERS } from './audit-actor-authority-boundary.mjs';

const ROOT = process.cwd();
const REQ = join(ROOT, 'src', 'modules', 'payout', 'payout-request.routes.ts');
const OLD = join(ROOT, 'src', 'modules', 'payout', 'payout.routes.ts');
const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

function runGuard() {
  const failures = [];
  if (!existsSync(REQ)) {
    console.error('GATE FAIL [payout-request-only]: payout-request.routes.ts ausente.');
    process.exit(1);
  }
  const code = stripComments(readFileSync(REQ, 'utf8'));

  // (a/b) sem aprovação/execução/worker/Bank
  for (const sym of ['approveActorWalletPayout', 'executeActorWalletPayout', 'runActorWalletPayoutWorkerCycle', 'startActorWalletPayoutWorker', 'bankTransactionService']) {
    if (new RegExp(`\\b${sym}\\b`).test(code)) failures.push(`rota request-only referencia ${sym} — proibido (não aprova/executa/move dinheiro).`);
  }
  if (/(INSERT\s+INTO|UPDATE)\s+bank_[a-z_]+/i.test(code)) failures.push('rota escreve bank_* direto — proibido.');
  if (/executed\s*:\s*true/.test(code)) failures.push('rota retorna executed:true — request-only deve ser executed:false.');

  // (c) legado/projeção como autoridade
  if (/seller_available|seller_payout/.test(code)) failures.push('rota referencia seller_available/seller_payout (legado).');
  if (/\bpayout_requests\b/.test(code)) failures.push('rota referencia payout_requests legado.');
  if (/availableBalanceCents/.test(code)) failures.push('rota referencia availableBalanceCents (não pode ser autoridade).');

  // (d) autoridade proibida / spoof
  for (const bad of ['businessAuthorizationService', 'organization_members', 'can_manage_financial', 'can_execute_']) {
    if (new RegExp(bad).test(code)) failures.push(`rota usa autoridade proibida: ${bad}.`);
  }
  if (/financial:execute_payout/.test(code)) failures.push('rota usa financial:execute_payout como autoridade.');
  if (/req\.actionContext|['"]x-actor-id['"]|req\.query[^;]*actorId/.test(code)) failures.push('rota usa actionContext/x-actor-id/query.actorId como subject.');
  if (/req\.body[^;]*requestedByUserId|requestedByUserId[^;]*req\.body|req\.body[^;]*tenant_id|req\.body[^;]*tenantId/.test(code)) {
    failures.push('rota aceita requestedByUserId/tenantId do body como autoridade.');
  }

  // (e) invariantes presentes
  if (!/\bcanRepresentActor\s*\(/.test(code)) failures.push('rota não gateia por canRepresentActor (autoridade obrigatória).');
  if (!/\brequestActorWalletPayout\s*\(/.test(code)) failures.push('rota não delega a requestActorWalletPayout.');
  if (!/executed\s*:\s*false/.test(code)) failures.push('rota não devolve executed:false.');
  if (!/requestedByUserId\s*:\s*userId\b/.test(code)) failures.push('subject (requestedByUserId) não está ligado a userId=req.user server-side.');

  // (f) nenhum endpoint approve/decision em rotas de payout
  for (const f of [REQ, OLD]) {
    if (!existsSync(f)) continue;
    const rc = stripComments(readFileSync(f, 'utf8'));
    if (/\bapproveActorWalletPayout\s*\(/.test(rc)) failures.push(`${f.replace(ROOT, '').replace(/\\/g, '/')} expõe approveActorWalletPayout em rota — approve endpoint proibido nesta frente.`);
    if (/['"][^'"]*\/(decision|approve)['"]/.test(rc) && /fastify\.(post|put|patch)/.test(rc)) {
      failures.push(`${f.replace(ROOT, '').replace(/\\/g, '/')} parece registrar rota /decision|/approve — proibido nesta frente.`);
    }
  }

  // (g) rotas antigas seguem fail-closed
  if (existsSync(OLD)) {
    const oldc = stripComments(readFileSync(OLD, 'utf8'));
    if ((oldc.match(/PAYOUT_HTTP_EXECUTION_DISABLED/g) || []).length < 1 || (oldc.match(/status\(403\)/g) || []).length < 3) {
      failures.push('rotas antigas (batches/execute-manual/fail) deixaram de ser fail-closed (PAYOUT_HTTP_EXECUTION_DISABLED 403).');
    }
  }

  // (h) baseline 0113 íntegro
  if ('core/unifybank/bank-http.routes.ts' in BASELINE || 'modules/payout/payout.routes.ts' in BASELINE) {
    failures.push('baseline 0113 regrediu: bank-http/payout voltou ao BASELINE.');
  }
  if (!('modules/payout/payout.routes.ts' in SAFE_SUBJECT_READERS)) {
    failures.push('payout.routes.ts saiu de SAFE_SUBJECT_READERS — regressão.');
  }

  if (failures.length > 0) {
    console.error('GATE FAIL [payout-request-only]:');
    failures.forEach((x) => console.error(`  ❌ ${x}`));
    process.exit(1);
  }
  console.log('[payout-request-only] POST /payouts/requests: canRepresentActor + requestActorWalletPayout + executed:false; sem approve/execute/worker/Bank; sem seller_available/payout_requests/availableBalanceCents/businessAuthorizationService; subject server-side; rotas antigas fail-closed; baseline 0113 íntegro.');
  console.log('GATE OK [payout-request-only] — entrada de payout é request-only, autoridade server-side via canRepresentActor.');
}

const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMain) runGuard();

export { runGuard };
