// backend/src/workers/financial-worker-gate.ts
// F-FINANCIAL-WORKERS-STRUCTURAL-DORMANCY-SEAL (DECISION-0128).
//
// Gate de DORMÊNCIA ESTRUTURAL dos workers financeiros que movem dinheiro (payout / reversal /
// bank-settlement). Enquanto o Core EXECUTION estiver em HOLD (DECISION-0128 §16 / F-PAYOUT-
// EXECUTION-SEAL), NENHUM desses workers pode iniciar no BOOT por padrão.
//
// Semântica FAIL-CLOSED / DEFAULT-OFF (estrita):
//   - inicia SOMENTE se a env flag for EXATAMENTE a string 'true';
//   - variável ausente, vazia, 'TRUE', '1', 'yes', ou qualquer outro valor → NÃO inicia;
//   - SEM auto-enable por NODE_ENV (development/test/production são irrelevantes aqui);
//   - sem bypass, sem fail-open.
// Espelha o padrão do firewall financeiro DECISION-0110 (process.env[FLAG] === 'true').
// NÃO é o mesmo de isFeatureEnabled (core/features/feature-flags.ts), que é DEFAULT-ON.

export type FinancialWorkerFlag =
  | 'ENABLE_PAYOUT_WORKER'
  | 'ENABLE_REVERSAL_WORKER'
  | 'ENABLE_BANK_SETTLEMENT_WORKER'
  // F-RLS-OBSERVABILITY-WORKERS-RESOLVE (DECISION-0149): observability cross-tenant default-off
  // até tenant-loop/RLS-runtime-live. Sob unificard_app rodariam cegos (0 linhas).
  | 'ENABLE_FINANCIAL_METRICS_WORKER'
  | 'ENABLE_RISK_ANALYSIS_WORKER'
  | 'ENABLE_FINANCIAL_ALERT_WORKER';

export function isFinancialWorkerEnabled(flag: FinancialWorkerFlag): boolean {
  // Estrito: só a string exata 'true' habilita. Tudo o mais (undefined/''/'TRUE'/'1'/'yes') = OFF.
  return process.env[flag] === 'true';
}
