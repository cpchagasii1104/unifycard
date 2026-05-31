// SLA Monitor Worker — detecta atrasos operacionais (settlement, payout, bank_settlement).
// Não altera bank_transactions, bank_ledger nem bank_accounts. Somente leitura + escrita em financial_sla_events e financial_alerts.

import { pool } from '@core/database/pool';
import { recordSlaEvent } from '@modules/sla/financial-sla-repository';
import { createFinancialAlert, hasUnresolvedAlert } from '@modules/alerts/financial-alert-repository';

const INTERVAL_MS = 60_000;
const SETTLEMENT_DELAY_MINUTES = 5;
const PAYOUT_DELAY_MINUTES = 10;
const BANK_SETTLEMENT_DELAY_MINUTES = 10;

async function ensureSlaAlert(
  tenantId: string,
  slaType: string,
  referenceId: string,
  message: string
): Promise<void> {
  const exists = await hasUnresolvedAlert(tenantId, 'FINANCIAL_SLA_BREACH', referenceId);
  if (exists) return;
  await createFinancialAlert(tenantId, {
    alertType: 'FINANCIAL_SLA_BREACH',
    referenceId,
    severity: 'warning',
    message,
  });
}

async function runSlaMonitorCycle(): Promise<void> {
  try {
    const now = new Date();

    // A) settlement_delay: payment_intents payment_status = escrowed há mais de 5 minutos
    const settlementResult = await pool.query<{ id: string; tenant_id: string; created_at: Date }>(
      `SELECT id, tenant_id, created_at
       FROM payment_intents
       WHERE payment_status = 'escrowed'
         AND created_at <= now() - interval '1 minute' * $1`,
      [SETTLEMENT_DELAY_MINUTES]
    );
    for (const row of settlementResult.rows) {
      const expectedAt = new Date(row.created_at.getTime() + SETTLEMENT_DELAY_MINUTES * 60 * 1000);
      const delaySeconds = Math.max(0, Math.floor((now.getTime() - expectedAt.getTime()) / 1000));
      await recordSlaEvent(row.tenant_id, {
        slaType: 'settlement_delay',
        referenceId: row.id,
        expectedAt,
        actualAt: now,
        delaySeconds,
      });
      await ensureSlaAlert(
        row.tenant_id,
        'settlement_delay',
        row.id,
        `Settlement delay: payment_intent ${row.id} em escrowed há mais de ${SETTLEMENT_DELAY_MINUTES} min`
      );
    }

    // B) payout_delay: payout_requests status = requested há mais de 10 minutos
    const payoutResult = await pool.query<{ id: string; tenant_id: string; created_at: Date }>(
      `SELECT id, tenant_id, created_at
       FROM payout_requests
       WHERE status = 'requested'
         AND created_at <= now() - interval '1 minute' * $1`,
      [PAYOUT_DELAY_MINUTES]
    );
    for (const row of payoutResult.rows) {
      const expectedAt = new Date(row.created_at.getTime() + PAYOUT_DELAY_MINUTES * 60 * 1000);
      const delaySeconds = Math.max(0, Math.floor((now.getTime() - expectedAt.getTime()) / 1000));
      await recordSlaEvent(row.tenant_id, {
        slaType: 'payout_delay',
        referenceId: row.id,
        expectedAt,
        actualAt: now,
        delaySeconds,
      });
      await ensureSlaAlert(
        row.tenant_id,
        'payout_delay',
        row.id,
        `Payout delay: payout_request ${row.id} em requested há mais de ${PAYOUT_DELAY_MINUTES} min`
      );
    }

    // C) bank_settlement_delay: bank_settlements status = pending há mais de 10 minutos
    const bankResult = await pool.query<{ id: string; tenant_id: string; created_at: Date }>(
      `SELECT id, tenant_id, created_at
       FROM bank_settlements
       WHERE status = 'pending'
         AND created_at <= now() - interval '1 minute' * $1`,
      [BANK_SETTLEMENT_DELAY_MINUTES]
    );
    for (const row of bankResult.rows) {
      const expectedAt = new Date(row.created_at.getTime() + BANK_SETTLEMENT_DELAY_MINUTES * 60 * 1000);
      const delaySeconds = Math.max(0, Math.floor((now.getTime() - expectedAt.getTime()) / 1000));
      await recordSlaEvent(row.tenant_id, {
        slaType: 'bank_settlement_delay',
        referenceId: row.id,
        expectedAt,
        actualAt: now,
        delaySeconds,
      });
      await ensureSlaAlert(
        row.tenant_id,
        'bank_settlement_delay',
        row.id,
        `Bank settlement delay: bank_settlement ${row.id} em pending há mais de ${BANK_SETTLEMENT_DELAY_MINUTES} min`
      );
    }
  } catch (err) {
    console.error('[SlaMonitorWorker] Cycle error:', err);
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startSlaMonitorWorker(): void {
  if (intervalId !== null) return;
  runSlaMonitorCycle().catch((err) => console.error('[SlaMonitorWorker] Initial run error:', err));
  intervalId = setInterval(runSlaMonitorCycle, INTERVAL_MS);
  console.log('[SlaMonitorWorker] Started (interval 60s, SLA monitor)');
}