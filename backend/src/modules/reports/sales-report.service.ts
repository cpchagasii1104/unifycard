// backend/src/modules/reports/sales-report.service.ts
// SPRINT 46: RELATÓRIOS OPERACIONAIS - Vendas

import { runQueriesWithTenant } from '@core/database/pool';
import { resolveConsolidationScope, resolveActorIdsByScope } from '../organization/consolidation-helper';
import type {
  SalesReportFilters,
  SalesReport,
  SalesByPeriod,
  SalesByChannel,
  SalesByActor,
  AverageTicket,
} from './sales-report.types';

/**
 * Service para relatórios de vendas
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - NÃO cria nova lógica econômica
 * - NÃO recalcula valores
 * - Apenas consolida dados existentes
 * - Relatórios = leitura
 */
class SalesReportService {
  /**
   * Gera relatório completo de vendas
   */
  async generateReport(
    tenantId: string,
    filters: SalesReportFilters & { userId?: string; actorId?: string } = {}
  ): Promise<SalesReport> {
    const startDate = filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Últimos 30 dias
    const endDate = filters.endDate || new Date();

    // SPRINT 51: Resolver escopo de consolidação
    let scopeActorIds: string[] | undefined = undefined;
    if (filters.userId && filters.actorId) {
      const scope = await resolveConsolidationScope(tenantId, filters.userId, filters.actorId, {
        organizationUnitId: filters.organizationUnitId,
        consolidated: filters.consolidated,
      });
      scopeActorIds = await resolveActorIdsByScope(tenantId, scope);
    }

    // Aplicar filtro de actors do escopo
    const effectiveFilters = {
      ...filters,
      scopeActorIds, // Usar scopeActorIds ao invés de actorId quando consolidado
    };

    // 1. Resumo geral
    const summary = await this.getSummary(tenantId, effectiveFilters);

    // 2. Vendas por período
    const byPeriod = await this.getSalesByPeriod(tenantId, effectiveFilters);

    // 3. Vendas por canal
    const byChannel = await this.getSalesByChannel(tenantId, effectiveFilters);

    // 4. Vendas por filial (actor)
    const byActor = await this.getSalesByActor(tenantId, effectiveFilters);

    // 5. Ticket médio por período
    const averageTicketByPeriod = await this.getAverageTicketByPeriod(tenantId, effectiveFilters);

    return {
      period: {
        startDate,
        endDate,
      },
      summary,
      byPeriod,
      byChannel,
      byActor,
      averageTicketByPeriod,
    };
  }

  /**
   * Resumo geral de vendas
   */
  private async getSummary(
    tenantId: string,
    filters: SalesReportFilters & { scopeActorIds?: string[] }
  ): Promise<SalesReport['summary']> {
    const startDate = filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = filters.endDate || new Date();

    let query = `
      SELECT
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(pt.amount), 0) as total_amount,
        COALESCE(SUM(CASE WHEN pt.status = 'SUCCESS' THEN pt.amount ELSE 0 END), 0) as total_paid,
        COALESCE(SUM(CASE WHEN pt.status = 'FAILED' THEN pt.amount ELSE 0 END), 0) as total_failed
      FROM orders o
      LEFT JOIN payment_intents pi ON o.id = pi.order_id
      LEFT JOIN payment_transactions pt ON pi.id = pt.payment_intent_id
      WHERE o.tenant_id = $1
        AND o.created_at >= $2
        AND o.created_at <= $3
    `;

    const params: any[] = [tenantId, startDate, endDate];

    // SPRINT 51: Aplicar filtro de escopo de consolidação
    if (filters.scopeActorIds && filters.scopeActorIds.length > 0) {
      query += ` AND (o.buyer_actor_id = ANY($${params.length + 1}::uuid[]) OR o.seller_actor_id = ANY($${params.length + 1}::uuid[]))`;
      params.push(filters.scopeActorIds);
    } else if (filters.actorId) {
      query += ` AND (o.buyer_actor_id = $${params.length + 1} OR o.seller_actor_id = $${params.length + 1})`;
      params.push(filters.actorId);
    }

    if (filters.channel && filters.channel !== 'ALL') {
      const channelValue = filters.channel === 'PDV' ? 'PDV' : 'MARKETPLACE';
      query += ` AND o.metadata->>'pdv_session_id' ${channelValue === 'PDV' ? 'IS NOT NULL' : 'IS NULL'}`;
    }

    const rows = await runQueriesWithTenant<{
      total_orders: string;
      total_amount: string;
      total_paid: string;
      total_failed: string;
    }>(tenantId, query, params);

    const row = rows[0] || {
      total_orders: '0',
      total_amount: '0',
      total_paid: '0',
      total_failed: '0',
    };

    const totalOrders = parseInt(row.total_orders) || 0;
    const totalAmount = parseFloat(row.total_amount) || 0;
    const totalPaid = parseFloat(row.total_paid) || 0;
    const totalFailed = parseFloat(row.total_failed) || 0;

    return {
      totalOrders,
      totalAmount,
      totalPaid,
      totalFailed,
      averageTicket: totalOrders > 0 ? totalPaid / totalOrders : 0,
    };
  }

  /**
   * Vendas por período (diário ou mensal)
   */
  private async getSalesByPeriod(
    tenantId: string,
    filters: SalesReportFilters & { scopeActorIds?: string[] }
  ): Promise<SalesByPeriod[]> {
    const startDate = filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = filters.endDate || new Date();

    let query = `
      SELECT
        DATE(o.created_at) as period,
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(pt.amount), 0) as total_amount,
        COALESCE(SUM(CASE WHEN pt.status = 'SUCCESS' THEN pt.amount ELSE 0 END), 0) as total_paid,
        COALESCE(SUM(CASE WHEN pt.status = 'FAILED' THEN pt.amount ELSE 0 END), 0) as total_failed
      FROM orders o
      LEFT JOIN payment_intents pi ON o.id = pi.order_id
      LEFT JOIN payment_transactions pt ON pi.id = pt.payment_intent_id
      WHERE o.tenant_id = $1
        AND o.created_at >= $2
        AND o.created_at <= $3
    `;

    const params: any[] = [tenantId, startDate, endDate];

    // SPRINT 51: Aplicar filtro de escopo de consolidação
    if (filters.scopeActorIds && filters.scopeActorIds.length > 0) {
      query += ` AND (o.buyer_actor_id = ANY($${params.length + 1}::uuid[]) OR o.seller_actor_id = ANY($${params.length + 1}::uuid[]))`;
      params.push(filters.scopeActorIds);
    } else if (filters.actorId) {
      query += ` AND (o.buyer_actor_id = $${params.length + 1} OR o.seller_actor_id = $${params.length + 1})`;
      params.push(filters.actorId);
    }

    if (filters.channel && filters.channel !== 'ALL') {
      const channelValue = filters.channel === 'PDV' ? 'PDV' : 'MARKETPLACE';
      query += ` AND o.metadata->>'pdv_session_id' ${channelValue === 'PDV' ? 'IS NOT NULL' : 'IS NULL'}`;
    }

    query += `
      GROUP BY DATE(o.created_at)
      ORDER BY period ASC
    `;

    const rows = await runQueriesWithTenant<{
      period: Date;
      total_orders: string;
      total_amount: string;
      total_paid: string;
      total_failed: string;
    }>(tenantId, query, params);

    return rows.map((row) => ({
      period: row.period.toISOString().split('T')[0],
      totalOrders: parseInt(row.total_orders) || 0,
      totalAmount: parseFloat(row.total_amount) || 0,
      totalPaid: parseFloat(row.total_paid) || 0,
      totalFailed: parseFloat(row.total_failed) || 0,
    }));
  }

  /**
   * Vendas por canal (PDV vs Marketplace)
   */
  private async getSalesByChannel(
    tenantId: string,
    filters: SalesReportFilters
  ): Promise<SalesByChannel[]> {
    const startDate = filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = filters.endDate || new Date();

    let query = `
      SELECT
        CASE 
          WHEN o.metadata->>'pdv_session_id' IS NOT NULL THEN 'PDV'
          ELSE 'MARKETPLACE'
        END as channel,
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(pt.amount), 0) as total_amount,
        COALESCE(SUM(CASE WHEN pt.status = 'SUCCESS' THEN pt.amount ELSE 0 END), 0) as total_paid
      FROM orders o
      LEFT JOIN payment_intents pi ON o.id = pi.order_id
      LEFT JOIN payment_transactions pt ON pi.id = pt.payment_intent_id
      WHERE o.tenant_id = $1
        AND o.created_at >= $2
        AND o.created_at <= $3
    `;

    const params: any[] = [tenantId, startDate, endDate];

    // SPRINT 51: Aplicar filtro de escopo de consolidação
    if (filters.scopeActorIds && filters.scopeActorIds.length > 0) {
      query += ` AND (o.buyer_actor_id = ANY($${params.length + 1}::uuid[]) OR o.seller_actor_id = ANY($${params.length + 1}::uuid[]))`;
      params.push(filters.scopeActorIds);
    } else if (filters.actorId) {
      query += ` AND (o.buyer_actor_id = $${params.length + 1} OR o.seller_actor_id = $${params.length + 1})`;
      params.push(filters.actorId);
    }

    query += `
      GROUP BY channel
      ORDER BY channel ASC
    `;

    const rows = await runQueriesWithTenant<{
      channel: string;
      total_orders: string;
      total_amount: string;
      total_paid: string;
    }>(tenantId, query, params);

    return rows.map((row) => ({
      channel: row.channel as 'PDV' | 'MARKETPLACE',
      totalOrders: parseInt(row.total_orders) || 0,
      totalAmount: parseFloat(row.total_amount) || 0,
      totalPaid: parseFloat(row.total_paid) || 0,
    }));
  }

  /**
   * Vendas por filial (actor)
   */
  private async getSalesByActor(
    tenantId: string,
    filters: SalesReportFilters
  ): Promise<SalesByActor[]> {
    const startDate = filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = filters.endDate || new Date();

    let query = `
      SELECT
        o.seller_actor_id as actor_id,
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(pt.amount), 0) as total_amount,
        COALESCE(SUM(CASE WHEN pt.status = 'SUCCESS' THEN pt.amount ELSE 0 END), 0) as total_paid
      FROM orders o
      LEFT JOIN payment_intents pi ON o.id = pi.order_id
      LEFT JOIN payment_transactions pt ON pi.id = pt.payment_intent_id
      WHERE o.tenant_id = $1
        AND o.created_at >= $2
        AND o.created_at <= $3
    `;

    const params: any[] = [tenantId, startDate, endDate];

    // SPRINT 51: Aplicar filtro de escopo de consolidação
    if (filters.scopeActorIds && filters.scopeActorIds.length > 0) {
      query += ` AND o.seller_actor_id = ANY($${params.length + 1}::uuid[])`;
      params.push(filters.scopeActorIds);
    } else if (filters.actorId) {
      query += ` AND o.seller_actor_id = $${params.length + 1}`;
      params.push(filters.actorId);
    }

    if (filters.channel && filters.channel !== 'ALL') {
      const channelValue = filters.channel === 'PDV' ? 'PDV' : 'MARKETPLACE';
      query += ` AND o.metadata->>'pdv_session_id' ${channelValue === 'PDV' ? 'IS NOT NULL' : 'IS NULL'}`;
    }

    query += `
      GROUP BY o.seller_actor_id
      ORDER BY total_paid DESC
    `;

    const rows = await runQueriesWithTenant<{
      actor_id: string;
      total_orders: string;
      total_amount: string;
      total_paid: string;
    }>(tenantId, query, params);

    return rows.map((row) => ({
      actorId: row.actor_id,
      totalOrders: parseInt(row.total_orders) || 0,
      totalAmount: parseFloat(row.total_amount) || 0,
      totalPaid: parseFloat(row.total_paid) || 0,
    }));
  }

  /**
   * Ticket médio por período
   */
  private async getAverageTicketByPeriod(
    tenantId: string,
    filters: SalesReportFilters & { scopeActorIds?: string[] }
  ): Promise<AverageTicket[]> {
    const startDate = filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = filters.endDate || new Date();

    let query = `
      SELECT
        DATE(o.created_at) as period,
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(CASE WHEN pt.status = 'SUCCESS' THEN pt.amount ELSE 0 END), 0) as total_amount
      FROM orders o
      LEFT JOIN payment_intents pi ON o.id = pi.order_id
      LEFT JOIN payment_transactions pt ON pi.id = pt.payment_intent_id
      WHERE o.tenant_id = $1
        AND o.created_at >= $2
        AND o.created_at <= $3
        AND pt.status = 'SUCCESS'
    `;

    const params: any[] = [tenantId, startDate, endDate];

    // SPRINT 51: Aplicar filtro de escopo de consolidação
    if (filters.scopeActorIds && filters.scopeActorIds.length > 0) {
      query += ` AND (o.buyer_actor_id = ANY($${params.length + 1}::uuid[]) OR o.seller_actor_id = ANY($${params.length + 1}::uuid[]))`;
      params.push(filters.scopeActorIds);
    } else if (filters.actorId) {
      query += ` AND (o.buyer_actor_id = $${params.length + 1} OR o.seller_actor_id = $${params.length + 1})`;
      params.push(filters.actorId);
    }

    if (filters.channel && filters.channel !== 'ALL') {
      const channelValue = filters.channel === 'PDV' ? 'PDV' : 'MARKETPLACE';
      query += ` AND o.metadata->>'pdv_session_id' ${channelValue === 'PDV' ? 'IS NOT NULL' : 'IS NULL'}`;
    }

    query += `
      GROUP BY DATE(o.created_at)
      ORDER BY period ASC
    `;

    const rows = await runQueriesWithTenant<{
      period: Date;
      total_orders: string;
      total_amount: string;
    }>(tenantId, query, params);

    return rows.map((row) => {
      const totalOrders = parseInt(row.total_orders) || 0;
      const totalAmount = parseFloat(row.total_amount) || 0;
      return {
        period: row.period.toISOString().split('T')[0],
        averageTicket: totalOrders > 0 ? totalAmount / totalOrders : 0,
        totalOrders,
        totalAmount,
      };
    });
  }
}

export const salesReportService = new SalesReportService();


