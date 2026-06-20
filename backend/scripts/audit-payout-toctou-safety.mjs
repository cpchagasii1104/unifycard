#!/usr/bin/env node
// Guard estrutural — F-PAYOUT-TOCTOU-SAFETY-HARDENING. Garante que executeActorWalletPayout revalide
// EXECUTE-TIME de forma >= APPROVAL-TIME: KYC/ATL/risco com envelope de PAYOUT (não transfer genérico) +
// bloqueio de recovery pending_approval. MORDE se essas defesas forem removidas/afrouxadas.
//
// Em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const SVC = join(ROOT, 'src/modules/wallet/actor-wallet-payout.service.ts');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];

if (!existsSync(SVC)) {
  failures.push('actor-wallet-payout.service.ts ausente.');
} else {
  const code = stripTs(readFileSync(SVC, 'utf-8'));

  // Isolar o corpo de executeActorWalletPayout (da assinatura até o fim do arquivo é suficiente p/ os checks).
  const execIdx = code.indexOf('async executeActorWalletPayout');
  const execBody = execIdx >= 0 ? code.slice(execIdx) : '';
  if (!execBody) failures.push('executeActorWalletPayout não encontrado.');

  // (1) execute-time DEVE INVOCAR requireFinancialRiskClearance (não só importar).
  if (!/requireFinancialRiskClearance\s*\(\s*tenantId/.test(execBody)) {
    failures.push('executeActorWalletPayout: não invoca requireFinancialRiskClearance(tenantId, ...) no execute.');
  }
  if (!/action:\s*'financial_payout'/.test(execBody)) {
    failures.push("executeActorWalletPayout: revalidação execute-time NÃO usa envelope de payout (action: 'financial_payout').");
  }
  // (2) NÃO pode revalidar payout com envelope genérico de transfer.
  if (/requireFinancialRiskClearance[\s\S]{0,200}?action:\s*'financial_transfer'/.test(execBody)) {
    failures.push("executeActorWalletPayout: revalidação execute-time usa action:'financial_transfer' (envelope errado) — deve ser 'financial_payout'.");
  }
  // (3) bloqueio de recovery pending_approval no execute.
  if (!/pending_approval/.test(execBody) || !/actor_wallet_recovery_obligations/.test(execBody)) {
    failures.push('executeActorWalletPayout: não bloqueia recovery pending_approval no execute.');
  }
  if (!/PAYOUT_RECOVERY_PENDING_APPROVAL_AT_EXECUTE/.test(execBody)) {
    failures.push('executeActorWalletPayout: sem erro observável PAYOUT_RECOVERY_PENDING_APPROVAL_AT_EXECUTE.');
  }
  // (4) erros observáveis execute-time.
  for (const codeName of ['PAYOUT_KYC_NOT_APPROVED_AT_EXECUTE', 'PAYOUT_ATL_NOT_CLEARED_AT_EXECUTE', 'PAYOUT_RISK_NOT_CLEARED_AT_EXECUTE']) {
    if (!new RegExp(codeName).test(code)) failures.push(`actor-wallet-payout.service: sem erro observável ${codeName}.`);
  }
  // (5) availableBalanceCents NÃO pode virar autorização de execute (segue projeção).
  if (/if\s*\([^)]*availableBalanceCents[^)]*\)\s*\{[\s\S]{0,120}?execute/i.test(execBody)) {
    failures.push('executeActorWalletPayout: availableBalanceCents usado como autorização — deve seguir só projeção.');
  }
  // (6) saldo segue bank_ledger (não inferir saldo fora do ledger no execute).
  if (!/bankLedgerRepository\.calculateBalance/.test(execBody)) {
    failures.push('executeActorWalletPayout: saldo não calculado por bank_ledger (calculateBalance ausente).');
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [payout-toctou-safety]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log("GATE OK [payout-toctou-safety] — executeActorWalletPayout revalida execute-time (KYC/ATL/risco com envelope 'financial_payout') + bloqueia recovery pending_approval; erros observáveis presentes; saldo via bank_ledger; availableBalanceCents só projeção.");
