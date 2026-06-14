#!/usr/bin/env node
// Guard estrutural — F-BANK-HTTP-AUTHORITY-BINDING (DECISION-0128).
//
// Cerca de REGRESSÃO sobre core/unifybank/bank-http.routes.ts. Os writers move-money
// (POST /transactions/simple|split) viraram REQUEST-ONLY (criam approval_request no Core,
// NÃO executam Bank). Este guard FALHA (exit 1) se bank-http:
//   (a) voltar a EXECUTAR dinheiro (getBankTransaction / createSimpleTransaction /
//       createTransactionWithSplit / bankTransactionService / INSERT|UPDATE bank_*);
//   (b) deixar de ser request-only (sem createFinancialApprovalRequest nos writers);
//   (c) usar availableBalanceCents como autorização;
//   (d) usar body.actor / actionContext / x-actor-id / tenant_id de body|query como autoridade;
//   (e) zerar o baseline 0113 enquanto payout ainda resta (payout DEVE seguir no BASELINE);
//   (f) sair "mascarado": bank-http precisa estar reconhecido em SAFE_SUBJECT_READERS, não sumir.
// Integrado em validate:regression-guards.

import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { BASELINE, SAFE_SUBJECT_READERS } from './audit-actor-authority-boundary.mjs';

const FILE = join(process.cwd(), 'src', 'core', 'unifybank', 'bank-http.routes.ts');
const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

function runGuard() {
  const failures = [];
  const code = stripComments(readFileSync(FILE, 'utf8'));

  // (a) execução de dinheiro
  const execPatterns = [
    /\bgetBankTransaction\s*\(/,
    /\bcreateSimpleTransaction\s*\(/,
    /\bcreateTransactionWithSplit\s*\(/,
    /\bbankTransactionService\b/,
    /\b(INSERT\s+INTO|UPDATE)\s+bank_[a-z_]+/i,
  ];
  for (const re of execPatterns) {
    if (re.test(code)) failures.push(`bank-http voltou a EXECUTAR dinheiro: ${re}`);
  }

  // (b) request-only
  if (!/\bcreateFinancialApprovalRequest\s*\(/.test(code)) {
    failures.push('bank-http não cria mais approval_request (writers deixaram de ser request-only).');
  }

  // (c) availableBalanceCents
  if (/availableBalanceCents/.test(code)) {
    failures.push('bank-http usa availableBalanceCents (read-model como autorização).');
  }

  // (d) autoridade client-declared
  if (/req\.body\??\.actor\b|req\.actionContext\b|['"]x-actor-id['"]/.test(code)) {
    failures.push('bank-http usa body.actor / actionContext / x-actor-id como autoridade.');
  }
  if (/req\.body[^;]*tenant_id|tenant_id[^;]*req\.body|req\.query[^;]*tenant_id|tenant_id[^;]*req\.query/.test(code)) {
    failures.push('bank-http usa tenant_id de body/query como autoridade.');
  }

  // (e) payout não pode "sumir" mascarado: deve seguir RECONHECIDO (BASELINE enquanto resíduo, OU
  // SAFE_SUBJECT_READERS quando fechado por frente própria — F-ACTOR-WALLET-PAYOUT-WIRING). Nunca apagado.
  const payoutBaselined = 'modules/payout/payout.routes.ts' in BASELINE;
  const payoutRecognized = 'modules/payout/payout.routes.ts' in SAFE_SUBJECT_READERS;
  if (!payoutBaselined && !payoutRecognized) {
    failures.push('payout sumiu do guard 0113 (nem BASELINE nem SAFE_SUBJECT_READERS) — baseline mascarado.');
  }
  // (f) bank-http não pode "sumir" — deve estar reconhecido (não mascarado) e fora do baseline.
  if ('core/unifybank/bank-http.routes.ts' in BASELINE) {
    failures.push('bank-http ainda está no BASELINE (não saiu de verdade).');
  }
  if (!('core/unifybank/bank-http.routes.ts' in SAFE_SUBJECT_READERS)) {
    failures.push('bank-http não está em SAFE_SUBJECT_READERS — saída mascarada (sem prova de subject server-side).');
  }

  if (failures.length > 0) {
    console.error('GATE FAIL [bank-http-authority-binding]:');
    failures.forEach((f) => console.error(`  ❌ ${f}`));
    process.exit(1);
  }
  console.log('[bank-http-authority-binding] writers request-only (createFinancialApprovalRequest; sem getBankTransaction/createSimple/createSplit/bankTransactionService/bank_* write); sem availableBalanceCents; sem body.actor/actionContext/x-actor-id/tenant body|query; payout segue no baseline 0113; bank-http em SAFE_SUBJECT_READERS.');
  console.log('GATE OK [bank-http-authority-binding] — bank-http não move dinheiro; binding ao Core; baseline 0113 não zerado.');
}

const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMain) runGuard();

export { runGuard };
