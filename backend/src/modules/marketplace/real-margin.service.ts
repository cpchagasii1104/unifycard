// backend/src/modules/marketplace/real-margin.service.ts
// SPRINT 61: MARGEM REAL POR PRODUTO / CANAL / FILIAL (READ-ONLY)

import { runQueriesWithTenant } from '@core/database/pool';
import { inventoryHoldingCostService } from './inventory-holding-cost.service';
import type {
  RealMarginReport,
  MarginChannel,
  GetMarginOptions,
  MarginConfig,
} from './real-margin.types';

/**
 * Service para cálculo de margem real
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - READ-ONLY: Nenhuma mutação de estado
 * - NÃO recalcula split
 * - NÃO recalcula preço
 * - NÃO inferir custo de produto
 * - Apenas consolida dados existentes
 * - Nenhuma automação
 * - Nenhuma sugestão
 * - Nenhuma persistência
 */
class RealMarginService {
  /**
   * Calcula margem por variante de produto
   */
  async getMarginByVariant(
    tenantId: string,
    options: GetMarginOptions = {},
    config: MarginConfig = {}
  ): Promise<RealMarginReport[]> {
    const includeHoldingCost = config.includeHoldingCost !== false;
    const periodStart = options.periodStart || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Últimos 30 dias
    const periodEnd = options.periodEnd || new Date();

    const conditions: string[] = [
      'o.tenant_id = $1',
      'o.status = \'SUBMITTED\'', // Apenas pedidos submetidos (com pagamento)
    ];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (options.productVariantId) {
      conditions.push(`oi.product_variant_id = $${paramIndex}`);
      params.push(options.productVariantId);
      paramIndex++;
    }

    if (options.actorId) {
      conditions.push(`o.buyer_actor_id = $${paramIndex}`);
      params.push(options.actorId);
      paramIndex++;
    }

    if (options.channel) {
      // Determinar canal baseado em metadata ou source
      // Por enquanto, vamos assumir que o canal está em order.metadata
      conditions.push(`o.metadata->>'source' = $${paramIndex}`);
      params.push(options.channel);
      paramIndex++;
    }

    params.push(periodStart, periodEnd);
    paramIndex += 2;

    // C56: receita baseada em bank_ledger (SSOT)
    // Semântica: accrual accounting (order.created_at)
    // NÃO usar metadata financeira, payment_transactions nem splits como fonte
    // Ref: RFC_C56_real_margin_viola_ssot.md — Decisão A2
    const query = `
      WITH ledger_revenue AS (
        -- Crédito em escrow_payments = dinheiro do comprador chegou
        -- Canônico: account_type + direction (sem filtro por reference_type)
        SELECT
          bt.order_id,
          SUM(bl.amount_cents) AS gross_revenue_cents
        FROM bank_transactions bt
        INNER JOIN bank_ledger bl ON bl.transaction_id = bt.id
        INNER JOIN bank_accounts ba ON ba.id = bl.account_id
        WHERE bt.tenant_id = $1
          AND bt.order_id IS NOT NULL
          AND ba.account_type = 'escrow_payments'
          AND bl.direction = 'credit'
          AND bl.amount_cents > 0
        GROUP BY bt.order_id
      ),
      ledger_fees AS (
        -- Fees: crédito em platform_fees por order_id
        SELECT
          bt.order_id,
          SUM(bl.amount_cents) AS platform_fees_cents
        FROM bank_transactions bt
        INNER JOIN bank_ledger bl ON bl.transaction_id = bt.id
        INNER JOIN bank_accounts ba ON ba.id = bl.account_id
        WHERE bt.tenant_id = $1
          AND bt.order_id IS NOT NULL
          AND ba.account_type = 'platform_fees'
          AND bl.direction = 'credit'
          AND bl.amount_cents > 0
        GROUP BY bt.order_id
      ),
      ledger_payouts AS (
        -- Payouts: crédito em seller_pending por order_id
        SELECT
          bt.order_id,
          SUM(bl.amount_cents) AS payouts_cents
        FROM bank_transactions bt
        INNER JOIN bank_ledger bl ON bl.transaction_id = bt.id
        INNER JOIN bank_accounts ba ON ba.id = bl.account_id
        WHERE bt.tenant_id = $1
          AND bt.order_id IS NOT NULL
          AND ba.account_type = 'seller_pending'
          AND bl.direction = 'credit'
          AND bl.amount_cents > 0
        GROUP BY bt.order_id
      ),
      order_revenue AS (
        -- Join com order_items APÓS agregação por order_id
        -- MAX() evita duplicação quando pedido tem múltiplos itens
        SELECT
          oi.product_variant_id,
          o.buyer_actor_id AS actor_id,
          COALESCE(o.metadata->>'source', 'MARKETPLACE') AS channel,
          MAX(lr.gross_revenue_cents) AS gross_revenue_cents,
          MAX(COALESCE(lf.platform_fees_cents, 0)) AS platform_fees_cents,
          MAX(COALESCE(lp.payouts_cents, 0)) AS payouts_cents,
          COUNT(DISTINCT o.id) AS order_count,
          COUNT(DISTINCT o.id) AS transaction_count
        FROM order_items oi
        INNER JOIN orders o ON oi.order_id = o.id
        INNER JOIN ledger_revenue lr ON lr.order_id = o.id
        LEFT JOIN ledger_fees lf ON lf.order_id = o.id
        LEFT JOIN ledger_payouts lp ON lp.order_id = o.id
        WHERE o.tenant_id = $1
          AND o.created_at >= $${paramIndex - 1}
          AND o.created_at <= $${paramIndex}
          ${options.productVariantId ? `AND oi.product_variant_id = $2` : ''}
          ${options.actorId ? `AND o.buyer_actor_id = $${options.productVariantId ? 3 : 2}` : ''}
          ${options.channel ? `AND o.metadata->>'source' = $${options.productVariantId && options.actorId ? 4 : options.productVariantId || options.actorId ? 3 : 2}` : ''}
        GROUP BY oi.product_variant_id, o.buyer_actor_id, o.metadata->>'source'
      )
      SELECT
        orv.product_variant_id,
        orv.actor_id,
        orv.channel,
        orv.gross_revenue_cents::numeric / 100 AS gross_revenue,
        -- discounts = 0: desconto embutido no valor final creditado no ledger
        0::numeric AS discounts,
        orv.platform_fees_cents::numeric / 100 AS platform_fees,
        orv.payouts_cents::numeric / 100 AS payouts,
        orv.order_count,
        orv.transaction_count
      FROM order_revenue orv
      ORDER BY orv.gross_revenue_cents DESC
      LIMIT ${options.limit || 100}
      OFFSET ${options.offset || 0}
    `;

    const rows = await runQueriesWithTenant<any>(tenantId, query, params);

    const reports: RealMarginReport[] = [];

    for (const row of rows) {
      const grossRevenue = parseFloat(row.gross_revenue) || 0;
      const discounts = parseFloat(row.discounts) || 0;
      const platformFees = parseFloat(row.platform_fees) || 0;
      const payouts = parseFloat(row.payouts) || 0;

      // Calcular holding cost se solicitado
      let holdingCost = 0;
      if (includeHoldingCost) {
        try {
          const holdingCosts = await inventoryHoldingCostService.getHoldingCosts(
            tenantId,
            {
              productVariantId: row.product_variant_id,
              actorId: row.actor_id,
            },
            {
              dailyHoldingRate: config.holdingCostDailyRate || 0.001,
            }
          );
          holdingCost = holdingCosts.reduce((sum, cost) => sum + cost.totalHoldingCost, 0);
        } catch (error) {
          console.warn(`[RealMargin] Erro ao calcular holding cost:`, error);
        }
      }

      // Calcular margem líquida
      const netMargin = grossRevenue - platformFees - holdingCost;
      const marginPercentage = grossRevenue > 0 ? (netMargin / grossRevenue) * 100 : 0;

      // Gerar explicação
      const explanation = this.generateExplanation(
        grossRevenue,
        discounts,
        platformFees,
        payouts,
        holdingCost,
        netMargin,
        marginPercentage
      );

      reports.push({
        productVariantId: row.product_variant_id,
        actorId: row.actor_id,
        channel: row.channel as MarginChannel,
        grossRevenue,
        discounts,
        platformFees,
        payouts,
        holdingCost,
        netMargin,
        marginPercentage,
        explanation,
        metadata: {
          transactionCount: parseInt(row.transaction_count) || 0,
          orderCount: parseInt(row.order_count) || 0,
          averageTicket: grossRevenue > 0 && parseInt(row.transaction_count) > 0 
            ? grossRevenue / parseInt(row.transaction_count) 
            : 0,
          periodStart,
          periodEnd,
        },
      });
    }

    return reports;
  }

  /**
   * Calcula margem por filial (actor)
   */
  async getMarginByActor(
    tenantId: string,
    options: GetMarginOptions = {},
    config: MarginConfig = {}
  ): Promise<RealMarginReport[]> {
    // Agregar por actor
    const reports = await this.getMarginByVariant(tenantId, options, config);
    
    // Agrupar por actor
    const byActor = new Map<string, RealMarginReport>();

    for (const report of reports) {
      if (!report.actorId) continue;

      const key = report.actorId;
      if (!byActor.has(key)) {
        byActor.set(key, {
          actorId: report.actorId,
          grossRevenue: 0,
          discounts: 0,
          platformFees: 0,
          payouts: 0,
          holdingCost: 0,
          netMargin: 0,
          marginPercentage: 0,
          explanation: '',
          metadata: {},
        });
      }

      const aggregated = byActor.get(key)!;
      aggregated.grossRevenue += report.grossRevenue;
      aggregated.discounts += report.discounts;
      aggregated.platformFees += report.platformFees;
      aggregated.payouts += report.payouts;
      aggregated.holdingCost += report.holdingCost;
      aggregated.netMargin += report.netMargin;
      aggregated.metadata.transactionCount = (aggregated.metadata.transactionCount || 0) + (report.metadata.transactionCount || 0);
      aggregated.metadata.orderCount = (aggregated.metadata.orderCount || 0) + (report.metadata.orderCount || 0);
    }

    // Recalcular margem percentual e explicação
    const result: RealMarginReport[] = [];
    for (const aggregated of byActor.values()) {
      aggregated.marginPercentage = aggregated.grossRevenue > 0 
        ? (aggregated.netMargin / aggregated.grossRevenue) * 100 
        : 0;
      aggregated.metadata.averageTicket = aggregated.metadata.transactionCount && aggregated.metadata.transactionCount > 0
        ? aggregated.grossRevenue / aggregated.metadata.transactionCount
        : 0;
      aggregated.explanation = this.generateExplanation(
        aggregated.grossRevenue,
        aggregated.discounts,
        aggregated.platformFees,
        aggregated.payouts,
        aggregated.holdingCost,
        aggregated.netMargin,
        aggregated.marginPercentage
      );
      result.push(aggregated);
    }

    return result.sort((a, b) => b.netMargin - a.netMargin);
  }

  /**
   * Calcula margem por canal (PDV | MARKETPLACE)
   */
  async getMarginByChannel(
    tenantId: string,
    options: GetMarginOptions = {},
    config: MarginConfig = {}
  ): Promise<RealMarginReport[]> {
    // Agregar por canal
    const reports = await this.getMarginByVariant(tenantId, options, config);
    
    // Agrupar por canal
    const byChannel = new Map<MarginChannel, RealMarginReport>();

    for (const report of reports) {
      if (!report.channel) continue;

      const key = report.channel;
      if (!byChannel.has(key)) {
        byChannel.set(key, {
          channel: report.channel,
          grossRevenue: 0,
          discounts: 0,
          platformFees: 0,
          payouts: 0,
          holdingCost: 0,
          netMargin: 0,
          marginPercentage: 0,
          explanation: '',
          metadata: {},
        });
      }

      const aggregated = byChannel.get(key)!;
      aggregated.grossRevenue += report.grossRevenue;
      aggregated.discounts += report.discounts;
      aggregated.platformFees += report.platformFees;
      aggregated.payouts += report.payouts;
      aggregated.holdingCost += report.holdingCost;
      aggregated.netMargin += report.netMargin;
      aggregated.metadata.transactionCount = (aggregated.metadata.transactionCount || 0) + (report.metadata.transactionCount || 0);
      aggregated.metadata.orderCount = (aggregated.metadata.orderCount || 0) + (report.metadata.orderCount || 0);
    }

    // Recalcular margem percentual e explicação
    const result: RealMarginReport[] = [];
    for (const aggregated of byChannel.values()) {
      aggregated.marginPercentage = aggregated.grossRevenue > 0 
        ? (aggregated.netMargin / aggregated.grossRevenue) * 100 
        : 0;
      aggregated.metadata.averageTicket = aggregated.metadata.transactionCount && aggregated.metadata.transactionCount > 0
        ? aggregated.grossRevenue / aggregated.metadata.transactionCount
        : 0;
      aggregated.explanation = this.generateExplanation(
        aggregated.grossRevenue,
        aggregated.discounts,
        aggregated.platformFees,
        aggregated.payouts,
        aggregated.holdingCost,
        aggregated.netMargin,
        aggregated.marginPercentage
      );
      result.push(aggregated);
    }

    return result.sort((a, b) => b.netMargin - a.netMargin);
  }

  /**
   * Gera explicação legível da margem
   */
  private generateExplanation(
    grossRevenue: number,
    discounts: number,
    platformFees: number,
    payouts: number,
    holdingCost: number,
    netMargin: number,
    marginPercentage: number
  ): string {
    const parts: string[] = [];

    parts.push(`Receita bruta: R$ ${grossRevenue.toFixed(2)}`);
    if (discounts > 0) {
      parts.push(`Descontos: R$ ${discounts.toFixed(2)}`);
    }
    parts.push(`Fees plataforma: R$ ${platformFees.toFixed(2)}`);
    if (payouts > 0) {
      parts.push(`Payouts: R$ ${payouts.toFixed(2)}`);
    }
    if (holdingCost > 0) {
      parts.push(`Custo estoque parado: R$ ${holdingCost.toFixed(2)}`);
    }
    parts.push(`Margem líquida: R$ ${netMargin.toFixed(2)} (${marginPercentage.toFixed(2)}%)`);

    return parts.join(' | ');
  }
}

export const realMarginService = new RealMarginService();


