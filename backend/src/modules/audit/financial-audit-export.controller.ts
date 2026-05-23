// Financial Audit Exporter — exportação auditável para compliance. Somente SELECT.
// Não altera bank_transactions, bank_ledger nem bank_accounts.

import type { FastifyPluginAsync } from 'fastify';
import { pool } from '@core/database/pool';

const MAX_RECORDS = 10_000;

const financialAuditExportController: FastifyPluginAsync = async (app) => {
  app.get<{
    Querystring: { start_date?: string; end_date?: string; tenant_id?: string };
  }>('/financial/audit/export', async (req, reply) => {
    const start_date = req.query.start_date;
    const end_date = req.query.end_date;
    const tenant_id = req.query.tenant_id;

    if (!start_date || !end_date) {
      return reply.status(400).send({
        error: 'start_date and end_date are required (ISO date or timestamp)',
      });
    }

    const hasTenant = !!tenant_id;

    try {
      // A) bank_transactions
      const transactionsQuery = hasTenant
        ? `SELECT id, tenant_id, reference_type, reference_id, created_at
           FROM bank_transactions
           WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz AND tenant_id = $3
           ORDER BY created_at ASC LIMIT ${MAX_RECORDS}`
        : `SELECT id, tenant_id, reference_type, reference_id, created_at
           FROM bank_transactions
           WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz
           ORDER BY created_at ASC LIMIT ${MAX_RECORDS}`;
      const transactionsParams = hasTenant ? [start_date, end_date, tenant_id] : [start_date, end_date];
      const transactionsResult = await pool.query(transactionsQuery, transactionsParams);

      // B) bank_ledger
      const ledgerQuery = hasTenant
        ? `SELECT transaction_id, account_id, direction, amount_cents, created_at
           FROM bank_ledger
           WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz AND tenant_id = $3
           ORDER BY created_at ASC LIMIT ${MAX_RECORDS}`
        : `SELECT transaction_id, account_id, direction, amount_cents, created_at
           FROM bank_ledger
           WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz
           ORDER BY created_at ASC LIMIT ${MAX_RECORDS}`;
      const ledgerParams = hasTenant ? [start_date, end_date, tenant_id] : [start_date, end_date];
      const ledgerResult = await pool.query(ledgerQuery, ledgerParams);

      // C) payout_requests
      const payoutsQuery = hasTenant
        ? `SELECT id, tenant_id, actor_id, amount_cents, status, created_at
           FROM payout_requests
           WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz AND tenant_id = $3
           ORDER BY created_at ASC LIMIT ${MAX_RECORDS}`
        : `SELECT id, tenant_id, actor_id, amount_cents, status, created_at
           FROM payout_requests
           WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz
           ORDER BY created_at ASC LIMIT ${MAX_RECORDS}`;
      const payoutsParams = hasTenant ? [start_date, end_date, tenant_id] : [start_date, end_date];
      const payoutsResult = await pool.query(payoutsQuery, payoutsParams);

      // D) bank_settlements
      const settlementsQuery = hasTenant
        ? `SELECT id, tenant_id, payout_id, amount_cents, status, created_at
           FROM bank_settlements
           WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz AND tenant_id = $3
           ORDER BY created_at ASC LIMIT ${MAX_RECORDS}`
        : `SELECT id, tenant_id, payout_id, amount_cents, status, created_at
           FROM bank_settlements
           WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz
           ORDER BY created_at ASC LIMIT ${MAX_RECORDS}`;
      const settlementsParams = hasTenant ? [start_date, end_date, tenant_id] : [start_date, end_date];
      const settlementsResult = await pool.query(settlementsQuery, settlementsParams);

      return reply.send({
        transactions: transactionsResult.rows,
        ledger: ledgerResult.rows,
        payouts: payoutsResult.rows,
        settlements: settlementsResult.rows,
      });
    } catch (err) {
      req.log.error(err);
      return reply.status(500).send({ error: 'Audit export failed' });
    }
  });
};

export default financialAuditExportController;