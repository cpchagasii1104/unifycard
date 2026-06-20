#!/usr/bin/env node
// Guard estrutural — F-ACTOR-WALLET-PAYOUT-PROOF-WIRING. Garante que os E2Es SENSÍVEIS de payout/recovery
// (que escrevem/movem dinheiro) recusem rodar contra DB não-efêmero: cada um DEVE definir assertEphemeral
// (que bloqueia unificard_dev + exige EXPECTED_DATABASE_NAME) E chamá-lo ANTES de qualquer escrita.
// Torna permanente e gateável a prova comportamental de payout SEM ligar payout, sem mover dinheiro real.
// Comment-stripped. Em validate:regression-guards.
//
// MORDE se algum E2E sensível: (a) perder a definição de assertEphemeral; (b) perder a chamada
// `await assertEphemeral()`; (c) perder o bloqueio explícito a 'unificard_dev'.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// E2Es sensíveis (escrevem/movem dinheiro ou mutam estado financeiro) que NÃO podem rodar contra DB real.
const SENSITIVE_E2ES = [
  'src/scripts/validate-pipeline-e2e-f2-actor-wallet-payout-request.ts',
  'src/scripts/validate-pipeline-e2e-f3-actor-wallet-payout-execution.ts',
  'src/scripts/validate-pipeline-e2e-c3-actor-wallet-debit-recovery.ts',
  'src/scripts/validate-pipeline-e2e-c7-recovery-finalization.ts',
  'src/scripts/validate-pipeline-e2e-payout-approve-endpoint.ts',
];

const failures = [];

for (const rel of SENSITIVE_E2ES) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) { failures.push(`E2E sensível ausente: ${rel}`); continue; }
  const code = stripTs(readFileSync(p, 'utf-8'));

  // (a) define assertEphemeral.
  if (!/(?:async\s+function|const)\s+assertEphemeral\b/.test(code)) {
    failures.push(`${rel}: não define assertEphemeral — E2E sensível deve recusar DB não-efêmero.`);
  }
  // (b) chama await assertEphemeral() (antes de qualquer escrita; chamada presente é o mínimo verificável estaticamente).
  if (!/await\s+assertEphemeral\s*\(\s*\)/.test(code)) {
    failures.push(`${rel}: não chama "await assertEphemeral()" — a recusa precisa rodar antes de tocar o DB.`);
  }
  // (c) bloqueio explícito a unificard_dev.
  if (!/unificard_dev/.test(code)) {
    failures.push(`${rel}: assertEphemeral não bloqueia 'unificard_dev' explicitamente.`);
  }
}

// Self-seed/funding helper: funding COVERAGE-AWARE por caminho canônico, sem burlar o Bank.
const SELF_SEED = 'src/scripts/test-support/payout-e2e-self-seed.ts';
{
  const p = join(ROOT, SELF_SEED);
  if (!existsSync(p)) {
    failures.push(`helper ausente: ${SELF_SEED}`);
  } else {
    const code = stripTs(readFileSync(p, 'utf-8'));
    if (!/await\s+assertEphemeral\s*\(\s*\)/.test(code)) failures.push(`${SELF_SEED}: não chama await assertEphemeral() antes do seed.`);
    if (!/unificard_dev/.test(code)) failures.push(`${SELF_SEED}: não bloqueia 'unificard_dev'.`);
    // funding NÃO pode usar raw insert em tabelas SSOT bancárias.
    if (/INSERT\s+INTO\s+bank_ledger|INSERT\s+INTO\s+bank_transactions|INSERT\s+INTO\s+bank_splits/i.test(code)) {
      failures.push(`${SELF_SEED}: raw INSERT em bank_ledger/transactions/splits — funding deve ser via service canônico (createSimpleTransaction/transfer).`);
    }
    // funding NÃO pode burlar o invariant do Bank.
    if (/DISABLE\s+TRIGGER|session_replication_role/i.test(code)) {
      failures.push(`${SELF_SEED}: usa DISABLE TRIGGER/session_replication_role — proibido burlar o invariant de coverage do Bank.`);
    }
    // funding DEVE usar o caminho canônico (crédito a conta system é coverage-exempt).
    if (!/createSimpleTransaction\s*\(/.test(code)) {
      failures.push(`${SELF_SEED}: não usa createSimpleTransaction (funding canônico coverage-aware).`);
    }
    // KYC de teste DEVE ser canônico (workflow submit→review via identityValidationService), nunca bypass.
    // raw UPDATE de identities.kyc_status = aprovar KYC "na marra" → proibido.
    if (/UPDATE\s+identities\b[\s\S]*?\bkyc_status\b/i.test(code)) {
      failures.push(`${SELF_SEED}: raw UPDATE identities.kyc_status — KYC de teste deve ser aprovado pelo caminho canônico (identityValidationService.reviewIdentityValidation), não bypass.`);
    }
    // self-seed DEVE aprovar KYC pelo caminho canônico (submit+review). Sem isso, o gate financeiro
    // (debit-side) bloqueia KYC_PENDING e os E2Es de payout/recovery nunca rodam full-green.
    if (!/reviewIdentityValidation\s*\(/.test(code)) {
      failures.push(`${SELF_SEED}: não usa reviewIdentityValidation — KYC de teste deve ser aprovado pelo caminho canônico (submit→review), não constante/bypass.`);
    }
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [payout-e2e-ephemeral-guard]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [payout-e2e-ephemeral-guard] — F2/F3/C3/C7 + payout-approve definem e chamam assertEphemeral e bloqueiam unificard_dev; self-seed funda coverage por caminho canônico (createSimpleTransaction, sem raw bank insert/trigger bypass) e aprova KYC pelo workflow canônico (submit→review, sem raw kyc_status UPDATE); E2Es sensíveis de payout/recovery recusam DB não-efêmero (prova gateável sem ligar payout).');
