// Financial Operations Panel — endpoints internos para visualizar o sistema financeiro.
// GET /internal/financial/transactions | ledger | audit | metrics | health
// Somente leitura (apenas SELECT). Nenhuma alteração em bank_transactions, bank_ledger, bank_accounts.

import type { FastifyPluginAsync } from 'fastify';
import { pool } from '@core/database/pool';
import { getFinancialMetrics } from '@core/observability/financial-metrics';
import { getFinancialHealth } from '@core/observability/financial-health';

const financialOperationsPanelController: FastifyPluginAsync = async (app) => {
  // A) Listar transações
  app.get('/financial/transactions', async (_req, reply) => {
    const result = await pool.query(`
      SELECT id, tenant_id, reference_type, reference_id, created_at
      FROM bank_transactions
      ORDER BY created_at DESC
      LIMIT 100
    `);
    return reply.send({ transactions: result.rows });
  });

  // B) Listar ledger
  app.get('/financial/ledger', async (_req, reply) => {
    const result = await pool.query(`
      SELECT transaction_id, account_id, direction, amount_cents, created_at
      FROM bank_ledger
      ORDER BY created_at DESC
      LIMIT 100
    `);
    return reply.send({ ledger: result.rows.map((r: any) => ({
      transaction_id: r.transaction_id,
      account_id: r.account_id,
      direction: r.direction,
      amount_cents: r.amount_cents != null ? Number(r.amount_cents) : null,
      created_at: r.created_at,
    })) });
  });

  // C) Listar audit trail
  app.get('/financial/audit', async (_req, reply) => {
    try {
      const result = await pool.query(`
        SELECT event_type, transaction_id, account_id, amount_cents, created_at
        FROM financial_audit_trail
        ORDER BY created_at DESC
        LIMIT 100
      `);
      return reply.send({ audit: result.rows.map((r: any) => ({
        event_type: r.event_type,
        transaction_id: r.transaction_id,
        account_id: r.account_id,
        amount_cents: r.amount_cents != null ? Number(r.amount_cents) : null,
        created_at: r.created_at,
      })) });
    } catch {
      return reply.send({ audit: [] });
    }
  });

  // D) Métricas
  app.get('/financial/metrics', async (_req, reply) => {
    return reply.send({ metrics: getFinancialMetrics() });
  });

  // E) Health
  app.get('/financial/health', async (_req, reply) => {
    const health = await getFinancialHealth(pool);
    return reply.send(health);
  });
};

export default financialOperationsPanelController;