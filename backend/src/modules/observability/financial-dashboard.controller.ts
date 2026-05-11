// Financial Operations Dashboard — GET /internal/financial/dashboard
// Estado operacional do sistema financeiro. Somente leitura (apenas SELECT).

import type { FastifyPluginAsync } from 'fastify';
import { pool } from '@core/database/pool';
import { checkLedgerIntegrity } from '@core/observability/ledger-integrity-monitor';
import { getFinancialMetrics } from '@core/observability/financial-metrics';

interface LedgerHealth {
  debit: number;
  credit: number;
  status: string;
}

const financialDashboardController: FastifyPluginAsync = async (app) => {
  app.get('/financial/dashboard', async (_req, reply) => {
    const client = await pool.connect();
    try {
      let ledger_health: LedgerHealth;
      try {
        ledger_health = await checkLedgerIntegrity(pool);
      } catch {
        const driftResult = await pool.query<{ total_debit: string; total_credit: string }>(`
          SELECT
            SUM(CASE WHEN direction = 'debit' THEN amount_cents ELSE 0 END)::text as total_debit,
            SUM(CASE WHEN direction = 'credit' THEN amount_cents ELSE 0 END)::text as total_credit
          FROM bank_ledger
        `);
        const row = driftResult.rows[0];
        ledger_health = {
          debit: Number(row?.total_debit ?? 0),
          credit: Number(row?.total_credit ?? 0),
          status: 'DRIFT',
        };
      }

      const metrics = getFinancialMetrics();

      const recentTx = await client.query<{ id: string; tenant_id: string; reference_type: string | null; reference_id: string | null; created_at: Date }>(`
        SELECT id, tenant_id, reference_type, reference_id, created_at
        FROM bank_transactions
        ORDER BY created_at DESC
        LIMIT 20
      `);

      let recent_audit: Array<{ event_type: string; transaction_id: string | null; account_id: string | null; amount_cents: number | null; created_at: Date }> = [];
      try {
        const auditResult = await client.query(`
          SELECT event_type, transaction_id, account_id, amount_cents, created_at
          FROM financial_audit_trail
          ORDER BY created_at DESC
          LIMIT 20
        `);
        recent_audit = auditResult.rows.map((r: any) => ({
          event_type: r.event_type,
          transaction_id: r.transaction_id,
          account_id: r.account_id,
          amount_cents: r.amount_cents != null ? Number(r.amount_cents) : null,
          created_at: r.created_at,
        }));
      } catch {
        recent_audit = [];
      }

      const alerts: Array<{ type: string; details: unknown }> = [];

      if (ledger_health.debit !== ledger_health.credit) {
        alerts.push({ type: 'ledger_drift', details: { debit: ledger_health.debit, credit: ledger_health.credit } });
      }

      // DECISION-0024: saldo vem do ledger (SSOT), não de cached_balance
      // (coluna deprecada). Alerta detecta contas cujo saldo agregado é
      // negativo via SUM(credit) - SUM(debit).
      try {
        const negResult = await client.query<{ account_id: string }>(`
          SELECT account_id
          FROM bank_ledger
          GROUP BY account_id
          HAVING SUM(CASE WHEN direction = 'credit' THEN amount_cents ELSE -amount_cents END) < 0
          LIMIT 5
        `);
        if (negResult.rows.length > 0) {
          alerts.push({ type: 'negative_balance', details: { account_ids: negResult.rows.map((r) => r.account_id) } });
        }
      } catch (_) {}

      const stuckResult = await client.query<{ id: string }>(`
        SELECT id
        FROM bank_transactions
        WHERE reference_type IN ('payout_request', 'bank_payout')
          AND internal_completed_at IS NULL
          AND created_at < now() - interval '1 hour'
        LIMIT 5
      `);
      if (stuckResult.rows.length > 0) {
        alerts.push({ type: 'stuck_payout', details: { transaction_ids: stuckResult.rows.map((r) => r.id) } });
      }

      return reply.send({
        ledger_health,
        metrics,
        recent_transactions: recentTx.rows.map((r) => ({
          id: r.id,
          tenant_id: r.tenant_id,
          reference_type: r.reference_type,
          reference_id: r.reference_id,
          created_at: r.created_at,
        })),
        recent_audit,
        alerts,
      });
    } finally {
      client.release();
    }
  });
};

export default financialDashboardController;
