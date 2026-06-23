// Risk Analysis Worker — detecta padrões suspeitos (MANY_PAYOUTS, LARGE_TRANSACTION, MANY_PAYMENT_ATTEMPTS).
// Não altera bank_transactions, bank_ledger nem bank_accounts. Somente leitura + escrita em financial_risk_events e financial_alerts.

import { pool } from '@core/database/pool';
import { isFinancialWorkerEnabled } from './financial-worker-gate';
import { recordRiskEvent } from '@modules/risk/financial-risk-repository';
import { createFinancialAlert, hasUnresolvedAlert } from '@modules/alerts/financial-alert-repository';
import { activateBreaker, isBreakerActive } from '@modules/circuit-breaker/financial-circuit-breaker-repository';

const INTERVAL_MS = 60_000;
const MANY_PAYOUTS_THRESHOLD = 5;
const MANY_PAYOUTS_WINDOW_MINUTES = 10;
const LARGE_TRANSACTION_CENTS = 2_000_000;
const MANY_PAYMENT_ATTEMPTS_THRESHOLD = 50;
const MANY_PAYMENT_ATTEMPTS_WINDOW_MINUTES = 5;
const HIGH_RISK_ALERT_THRESHOLD = 70;
const CIRCUIT_BREAKER_RISK_THRESHOLD = 90;

async function ensureRiskAlert(
  tenantId: string,
  actorId: string,
  riskType: string,
  riskScore: number,
  message: string
): Promise<void> {
  if (riskScore < HIGH_RISK_ALERT_THRESHOLD) return;
  const referenceId = `${actorId}-${riskType}`;
  const exists = await hasUnresolvedAlert(tenantId, 'FINANCIAL_RISK_DETECTED', referenceId);
  if (exists) return;
  await createFinancialAlert(tenantId, {
    alertType: 'FINANCIAL_RISK_DETECTED',
    referenceId,
    severity: 'critical',
    message,
  });
}

async function ensureCircuitBreakerIfHighRisk(
  tenantId: string,
  riskScore: number
): Promise<void> {
  if (riskScore < CIRCUIT_BREAKER_RISK_THRESHOLD) return;
  const alreadyActive = await isBreakerActive(tenantId, 'payments');
  if (alreadyActive) return;
  await activateBreaker(tenantId, {
    breakerType: 'payments',
    triggerReason: 'high_risk_activity',
  });
}

async function runRiskAnalysisCycle(): Promise<void> {
  try {
    // A) MANY_PAYOUTS: mais de 5 payouts em 10 minutos por (tenant_id, actor_id)
    const payoutsResult = await pool.query<{ tenant_id: string; actor_id: string; cnt: string }>(
      `SELECT tenant_id, actor_id, COUNT(*)::text as cnt
       FROM payout_requests
       WHERE created_at >= now() - interval '1 minute' * $2
       GROUP BY tenant_id, actor_id
       HAVING COUNT(*) > $1`,
      [MANY_PAYOUTS_THRESHOLD, MANY_PAYOUTS_WINDOW_MINUTES]
    );
    for (const row of payoutsResult.rows) {
      const count = parseInt(row.cnt, 10);
      await recordRiskEvent(row.tenant_id, {
        actorId: row.actor_id,
        riskType: 'MANY_PAYOUTS',
        riskScore: 70,
        referenceId: null,
        details: { count, windowMinutes: MANY_PAYOUTS_WINDOW_MINUTES },
      });
      await ensureRiskAlert(
        row.tenant_id,
        row.actor_id,
        'MANY_PAYOUTS',
        70,
        `MANY_PAYOUTS: ${count} payouts em ${MANY_PAYOUTS_WINDOW_MINUTES} min (actor=${row.actor_id})`
      );
      await ensureCircuitBreakerIfHighRisk(row.tenant_id, 70);
    }

    // B) LARGE_TRANSACTION: transação > 2.000.000 centavos (último minuto para evitar duplicatas)
    const largeTxResult = await pool.query<{ id: string; tenant_id: string; actor_id: string; amount_cents: string }>(
      `SELECT id, tenant_id, actor_id, amount_cents
       FROM bank_transactions
       WHERE amount_cents > $1 AND created_at >= now() - interval '1 minute'`,
      [LARGE_TRANSACTION_CENTS]
    );
    for (const row of largeTxResult.rows) {
      await recordRiskEvent(row.tenant_id, {
        actorId: row.actor_id,
        riskType: 'LARGE_TRANSACTION',
        riskScore: 60,
        referenceId: row.id,
        details: { amount_cents: parseInt(row.amount_cents, 10), transaction_id: row.id },
      });
      await ensureCircuitBreakerIfHighRisk(row.tenant_id, 60);
    }

    // C) MANY_PAYMENT_ATTEMPTS: mais de 50 payment_intents em 5 minutos por tenant
    const intentsResult = await pool.query<{ tenant_id: string; cnt: string }>(
      `SELECT tenant_id, COUNT(*)::text as cnt
       FROM payment_intents
       WHERE created_at >= now() - interval '1 minute' * $2
       GROUP BY tenant_id
       HAVING COUNT(*) > $1`,
      [MANY_PAYMENT_ATTEMPTS_THRESHOLD, MANY_PAYMENT_ATTEMPTS_WINDOW_MINUTES]
    );
    for (const row of intentsResult.rows) {
      const count = parseInt(row.cnt, 10);
      await recordRiskEvent(row.tenant_id, {
        actorId: row.tenant_id,
        riskType: 'MANY_PAYMENT_ATTEMPTS',
        riskScore: 80,
        referenceId: null,
        details: { count, windowMinutes: MANY_PAYMENT_ATTEMPTS_WINDOW_MINUTES },
      });
      await ensureRiskAlert(
        row.tenant_id,
        row.tenant_id,
        'MANY_PAYMENT_ATTEMPTS',
        80,
        `MANY_PAYMENT_ATTEMPTS: ${count} intents em ${MANY_PAYMENT_ATTEMPTS_WINDOW_MINUTES} min (tenant=${row.tenant_id})`
      );
      await ensureCircuitBreakerIfHighRisk(row.tenant_id, 80);
    }
  } catch (err) {
    console.error('[RiskAnalysisWorker] Cycle error:', err);
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startRiskAnalysisWorker(): void {
  // 🔴 F-RLS-OBSERVABILITY-WORKERS-RESOLVE (DECISION-0149): default-off. Detecção CROSS-TENANT crua —
  // sob unificard_app rodaria cega (0 linhas). Só liga com flag explícita; tenant-loop ao reativar.
  if (!isFinancialWorkerEnabled('ENABLE_RISK_ANALYSIS_WORKER')) {
    console.log('[RiskAnalysisWorker] DESLIGADO (default-off; ENABLE_RISK_ANALYSIS_WORKER≠true).');
    return;
  }
  if (intervalId !== null) return;
  runRiskAnalysisCycle().catch((err) => console.error('[RiskAnalysisWorker] Initial run error:', err));
  intervalId = setInterval(runRiskAnalysisCycle, INTERVAL_MS);
  console.log('[RiskAnalysisWorker] Started (interval 60s, risk detection)');
}