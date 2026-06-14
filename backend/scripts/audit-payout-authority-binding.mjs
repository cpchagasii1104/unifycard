#!/usr/bin/env node
// Guard estrutural — F-ACTOR-WALLET-PAYOUT-WIRING (DECISION-0128).
//
// Cerca de REGRESSÃO sobre modules/payout/payout.routes.ts. Os writers move-money/estado-financeiro
// (POST /payouts/batches, /orders/:id/execute-manual, /orders/:id/fail) viraram FAIL-CLOSED (403
// PAYOUT_HTTP_EXECUTION_DISABLED). Este guard FALHA (exit 1) se payout:
//   (a) voltar a EXECUTAR (createPayoutBatch / executePayoutManual / markAsFailed / bankTransactionService /
//       INSERT|UPDATE bank_*);
//   (b) deixar de ser fail-closed (sem PAYOUT_HTTP_EXECUTION_DISABLED nos writers);
//   (c) usar availableBalanceCents ou seller_available como autorização;
//   (d) usar body.actor / req.actionContext / x-actor-id / tenant_id de body|query como autoridade;
//   (e) regredir o baseline 0113 (bank-http/payout devem estar em SAFE_SUBJECT_READERS, não no BASELINE);
//   (f) sair "mascarado" (payout precisa estar reconhecido em SAFE_SUBJECT_READERS, não sumir).
// Integrado em validate:regression-guards.

import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { BASELINE, SAFE_SUBJECT_READERS } from './audit-actor-authority-boundary.mjs';

const FILE = join(process.cwd(), 'src', 'modules', 'payout', 'payout.routes.ts');
const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

function runGuard() {
  const failures = [];
  const code = stripComments(readFileSync(FILE, 'utf8'));

  // (a) execução / mudança de estado financeiro
  const execPatterns = [
    /\bcreatePayoutBatch\s*\(/,
    /\bexecutePayoutManual\s*\(/,
    /\bmarkAsFailed\s*\(/,
    /\bbankTransactionService\b/,
    /\b(INSERT\s+INTO|UPDATE)\s+bank_[a-z_]+/i,
  ];
  for (const re of execPatterns) {
    if (re.test(code)) failures.push(`payout voltou a EXECUTAR/mudar estado financeiro: ${re}`);
  }

  // (b) fail-closed presente
  if (!/PAYOUT_HTTP_EXECUTION_DISABLED/.test(code)) {
    failures.push('payout writers não estão fail-closed (sem PAYOUT_HTTP_EXECUTION_DISABLED).');
  }
  const disabled403 = (code.match(/status\(403\)/g) || []).length;
  if (disabled403 < 3) {
    failures.push(`os 3 writers (batches/execute-manual/fail) deveriam responder 403 (encontrados status(403)=${disabled403}).`);
  }

  // (c) read-model / legado como autorização
  if (/availableBalanceCents/.test(code)) failures.push('payout usa availableBalanceCents como autorização.');
  if (/seller_available/.test(code)) failures.push('payout referencia seller_available (legado) — não pode autorizar payout.');

  // (d) autoridade client-declared
  if (/req\.body\??\.actor\b|req\.actionContext\b|['"]x-actor-id['"]/.test(code)) {
    failures.push('payout usa body.actor / req.actionContext / x-actor-id como autoridade.');
  }
  if (/req\.body[^;]*tenant_id|tenant_id[^;]*req\.body|req\.query[^;]*tenant_id|tenant_id[^;]*req\.query/.test(code)) {
    failures.push('payout usa tenant_id de body/query como autoridade.');
  }

  // (e/f) integridade do baseline 0113
  if ('modules/payout/payout.routes.ts' in BASELINE) {
    failures.push('payout ainda está no BASELINE (não saiu de verdade).');
  }
  if (!('modules/payout/payout.routes.ts' in SAFE_SUBJECT_READERS)) {
    failures.push('payout não está em SAFE_SUBJECT_READERS — saída mascarada (sem prova de subject server-side).');
  }
  if ('core/unifybank/bank-http.routes.ts' in BASELINE) {
    failures.push('bank-http REGREDIU para o BASELINE (deveria seguir em SAFE_SUBJECT_READERS).');
  }
  if (!('core/unifybank/bank-http.routes.ts' in SAFE_SUBJECT_READERS)) {
    failures.push('bank-http saiu de SAFE_SUBJECT_READERS — regressão da frente anterior.');
  }

  if (failures.length > 0) {
    console.error('GATE FAIL [payout-authority-binding]:');
    failures.forEach((f) => console.error(`  ❌ ${f}`));
    process.exit(1);
  }
  console.log('[payout-authority-binding] writers fail-closed (PAYOUT_HTTP_EXECUTION_DISABLED; sem createPayoutBatch/executePayoutManual/markAsFailed/bankTransactionService/bank_* write); sem availableBalanceCents/seller_available; sem body.actor/actionContext/x-actor-id/tenant body|query; payout+bank-http em SAFE_SUBJECT_READERS; BASELINE 0113 sem resíduo financeiro.');
  console.log('GATE OK [payout-authority-binding] — payout não executa dinheiro; readers com subject server-side; baseline 0113 íntegro.');
}

const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMain) runGuard();

export { runGuard };
