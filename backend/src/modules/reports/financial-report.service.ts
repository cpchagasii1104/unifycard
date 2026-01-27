// backend/src/modules/reports/financial-report.service.ts
// SPRINT 46: RELATÓRIOS OPERACIONAIS - Financeiro

import { runQueriesWithTenant } from '@core/database/pool';
import type {
  FinancialReportFilters,
  FinancialReport,
  FinancialSummary,
  FinancialByPeriod,
  FinancialBySplit,
} from './financial-report.types';

/**
 * Service para relatórios financeiros
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - NÃO cria nova lógica econômica
 * - NÃO recalcula valores
 * - Apenas consolida dados existentes
 * - Relatórios = leitura
 */
class FinancialReportService {
  /**
   * Gera relatório completo financeiro
   */
  async generateReport(
    tenantId: string,
    filters: FinancialReportFilters = {}
  ): Promise<FinancialReport> {
    const startDate = filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = filters.endDate || new Date();

    // 1. Resumo geral
    const summary = await this.getSummary(tenantId, filters);

    // 2. Financeiro por período
    const byPeriod = await this.getFinancialByPeriod(tenantId, filters);

    // 3. Financeiro por split (role)
    const bySplit = await this.getFinancialBySplit(tenantId, filters);

    // 4. Pendências (FAILED)
    const pending = await this.getPending(tenantId, filters);

    return {
      period: {
        startDate,
        endDate,
      },
      summary,
      byPeriod,
      bySplit,
      pending,
    };
  }

  /**
   * Resumo financeiro geral
   */
  private async getSummary(
    tenantId: string,
    filters: FinancialReportFilters
  ): Promise<FinancialSummary> {
    const startDate = filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = filters.endDate || new Date();

    let query = `
      SELECT
        COALESCE(SUM(CASE WHEN pt.status = 'SUCCESS' THEN pt.amount ELSE 0 END), 0) as total_received,
        COALESCE(SUM(CASE WHEN pt.status = 'FAILED' THEN pt.amount ELSE 0 END), 0) as failed_amount
      FROM payment_transactions pt
      INNER JOIN payment_intents pi ON pt.payment_intent_id = pi.id
      WHERE pt.tenant_id = $1
        AND pt.created_at >= $2
        AND pt.created_at <= $3
    `;

    const params: any[] = [tenantId, startDate, endDate];

    if (filters.actorId) {
      query += ` AND pi.order_id IN (
        SELECT id FROM orders WHERE tenant_id = $1 AND (buyer_actor_id = $${params.length + 1} OR seller_actor_id = $${params.length + 1})
      )`;
      params.push(filters.actorId);
    }

    const paymentRows = await runQueriesWithTenant<{
      total_received: string;
      failed_amount: string;
    }>(tenantId, query, params);

    const paymentRow = paymentRows[0] || {
      total_received: '0',
      failed_amount: '0',
    };

    // Total repassado (payouts SUCCESS)
    let payoutQuery = `
      SELECT
        COALESCE(SUM(CASE WHEN pt.status = 'SUCCESS' THEN pt.amount ELSE 0 END), 0) as total_paid_out,
        COALESCE(SUM(CASE WHEN ps.role = 'PLATFORM' THEN ps.amount ELSE 0 END), 0) as platform_fees
      FROM payout_transactions pt
      INNER JOIN payment_intent_splits ps ON pt.payment_split_id = ps.id
      WHERE pt.tenant_id = $1
        AND pt.created_at >= $2
        AND pt.created_at <= $3
    `;

    const payoutParams: any[] = [tenantId, startDate, endDate];

    if (filters.actorId) {
      payoutQuery += ` AND pt.recipient_actor_id = $${payoutParams.length + 1}`;
      payoutParams.push(filters.actorId);
    }

    const payoutRows = await runQueriesWithTenant<{
      total_paid_out: string;
      platform_fees: string;
    }>(tenantId, payoutQuery, payoutParams);

    const payoutRow = payoutRows[0] || {
      total_paid_out: '0',
      platform_fees: '0',
    };

    // Pendências (PENDING)
    let pendingQuery = `
      SELECT
        COALESCE(SUM(pt.amount), 0) as pending_amount
      FROM payment_transactions pt
      WHERE pt.tenant_id = $1
        AND pt.status = 'PENDING'
        AND pt.created_at >= $2
        AND pt.created_at <= $3
    `;

    const pendingParams: any[] = [tenantId, startDate, endDate];

    if (filters.actorId) {
      pendingQuery += ` AND pt.payment_intent_id IN (
        SELECT id FROM payment_intents WHERE order_id IN (
          SELECT id FROM orders WHERE tenant_id = $1 AND (buyer_actor_id = $${pendingParams.length + 1} OR seller_actor_id = $${pendingParams.length + 1})
        )
      )`;
      pendingParams.push(filters.actorId);
    }

    const pendingRows = await runQueriesWithTenant<{
      pending_amount: string;
    }>(tenantId, pendingQuery, pendingParams);

    const pendingRow = pendingRows[0] || {
      pending_amount: '0',
    };

    return {
      totalReceived: parseFloat(paymentRow.total_received) || 0,
      totalPaidOut: parseFloat(payoutRow.total_paid_out) || 0,
      platformFees: parseFloat(payoutRow.platform_fees) || 0,
      pendingAmount: parseFloat(pendingRow.pending_amount) || 0,
      failedAmount: parseFloat(paymentRow.failed_amount) || 0,
    };
  }

  /**
   * Financeiro por período
   */
  private async getFinancialByPeriod(
    tenantId: string,
    filters: FinancialReportFilters
  ): Promise<FinancialByPeriod[]> {
    const startDate = filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = filters.endDate || new Date();

    let query = `
      SELECT
        DATE(pt.created_at) as period,
        COALESCE(SUM(CASE WHEN pt.status = 'SUCCESS' THEN pt.amount ELSE 0 END), 0) as total_received
      FROM payment_transactions pt
      WHERE pt.tenant_id = $1
        AND pt.created_at >= $2
        AND pt.created_at <= $3
    `;

    const params: any[] = [tenantId, startDate, endDate];

    if (filters.actorId) {
      query += ` AND pt.payment_intent_id IN (
        SELECT id FROM payment_intents WHERE order_id IN (
          SELECT id FROM orders WHERE tenant_id = $1 AND (buyer_actor_id = $${params.length + 1} OR seller_actor_id = $${params.length + 1})
        )
      )`;
      params.push(filters.actorId);
    }

    query += `
      GROUP BY DATE(pt.created_at)
      ORDER BY period ASC
    `;

    const paymentRows = await runQueriesWithTenant<{
      period: Date;
      total_received: string;
    }>(tenantId, query, params);

    // Buscar payouts por período
    let payoutQuery = `
      SELECT
        DATE(pt.created_at) as period,
        COALESCE(SUM(CASE WHEN pt.status = 'SUCCESS' THEN pt.amount ELSE 0 END), 0) as total_paid_out,
        COALESCE(SUM(CASE WHEN ps.role = 'PLATFORM' AND pt.status = 'SUCCESS' THEN ps.amount ELSE 0 END), 0) as platform_fees
      FROM payout_transactions pt
      INNER JOIN payment_intent_splits ps ON pt.payment_split_id = ps.id
      WHERE pt.tenant_id = $1
        AND pt.created_at >= $2
        AND pt.created_at <= $3
    `;

    const payoutParams: any[] = [tenantId, startDate, endDate];

    if (filters.actorId) {
      payoutQuery += ` AND pt.recipient_actor_id = $${payoutParams.length + 1}`;
      payoutParams.push(filters.actorId);
    }

    payoutQuery += `
      GROUP BY DATE(pt.created_at)
      ORDER BY period ASC
    `;

    const payoutRows = await runQueriesWithTenant<{
      period: Date;
      total_paid_out: string;
      platform_fees: string;
    }>(tenantId, payoutQuery, payoutParams);

    // Consolidar por período
    const periodMap = new Map<string, FinancialByPeriod>();

    paymentRows.forEach((row) => {
      const period = row.period.toISOString().split('T')[0];
      periodMap.set(period, {
        period,
        totalReceived: parseFloat(row.total_received) || 0,
        totalPaidOut: 0,
        platformFees: 0,
      });
    });

    payoutRows.forEach((row) => {
      const period = row.period.toISOString().split('T')[0];
      const existing = periodMap.get(period) || {
        period,
        totalReceived: 0,
        totalPaidOut: 0,
        platformFees: 0,
      };
      existing.totalPaidOut = parseFloat(row.total_paid_out) || 0;
      existing.platformFees = parseFloat(row.platform_fees) || 0;
      periodMap.set(period, existing);
    });

    return Array.from(periodMap.values()).sort((a, b) => a.period.localeCompare(b.period));
  }

  /**
   * Financeiro por split (role)
   */
  private async getFinancialBySplit(
    tenantId: string,
    filters: FinancialReportFilters
  ): Promise<FinancialBySplit[]> {
    const startDate = filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = filters.endDate || new Date();

    let query = `
      SELECT
        ps.role,
        COALESCE(SUM(ps.amount), 0) as total_amount,
        COUNT(DISTINCT pt.id) as total_payouts,
        COUNT(DISTINCT CASE WHEN pt.status = 'SUCCESS' THEN pt.id END) as successful_payouts,
        COUNT(DISTINCT CASE WHEN pt.status = 'FAILED' THEN pt.id END) as failed_payouts
      FROM payment_intent_splits ps
      LEFT JOIN payout_transactions pt ON ps.id = pt.payment_split_id
      WHERE ps.tenant_id = $1
        AND ps.created_at >= $2
        AND ps.created_at <= $3
    `;

    const params: any[] = [tenantId, startDate, endDate];

    if (filters.actorId) {
      query += ` AND ps.recipient_actor_id = $${params.length + 1}`;
      params.push(filters.actorId);
    }

    query += `
      GROUP BY ps.role
      ORDER BY ps.role ASC
    `;

    const rows = await runQueriesWithTenant<{
      role: string;
      total_amount: string;
      total_payouts: string;
      successful_payouts: string;
      failed_payouts: string;
    }>(tenantId, query, params);

    return rows.map((row) => ({
      role: row.role,
      totalAmount: parseFloat(row.total_amount) || 0,
      totalPayouts: parseInt(row.total_payouts) || 0,
      successfulPayouts: parseInt(row.successful_payouts) || 0,
      failedPayouts: parseInt(row.failed_payouts) || 0,
    }));
  }

  /**
   * Pendências (FAILED)
   */
  private async getPending(
    tenantId: string,
    filters: FinancialReportFilters
  ): Promise<FinancialReport['pending']> {
    const startDate = filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = filters.endDate || new Date();

    let query = `
      SELECT
        pt.payment_intent_id,
        pi.order_id,
        pt.amount,
        pt.status,
        pt.error_code
      FROM payment_transactions pt
      INNER JOIN payment_intents pi ON pt.payment_intent_id = pi.id
      WHERE pt.tenant_id = $1
        AND pt.status IN ('PENDING', 'FAILED')
        AND pt.created_at >= $2
        AND pt.created_at <= $3
    `;

    const params: any[] = [tenantId, startDate, endDate];

    if (filters.actorId) {
      query += ` AND pi.order_id IN (
        SELECT id FROM orders WHERE tenant_id = $1 AND (buyer_actor_id = $${params.length + 1} OR seller_actor_id = $${params.length + 1})
      )`;
      params.push(filters.actorId);
    }

    query += `
      ORDER BY pt.created_at DESC
      LIMIT 100
    `;

    const rows = await runQueriesWithTenant<{
      payment_intent_id: string;
      order_id: string;
      amount: string;
      status: string;
      error_code: string | null;
    }>(tenantId, query, params);

    return rows.map((row) => ({
      paymentIntentId: row.payment_intent_id,
      orderId: row.order_id,
      amount: parseFloat(row.amount) || 0,
      status: row.status,
      errorCode: row.error_code || undefined,
    }));
  }
}

export const financialReportService = new FinancialReportService();




