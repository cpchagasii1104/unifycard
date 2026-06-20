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

if (failures.length > 0) {
  console.error('GATE FAIL [payout-e2e-ephemeral-guard]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [payout-e2e-ephemeral-guard] — F2/F3/C3/C7 + payout-approve definem e chamam assertEphemeral e bloqueiam unificard_dev; E2Es sensíveis de payout/recovery recusam DB não-efêmero (prova gateável sem ligar payout).');
