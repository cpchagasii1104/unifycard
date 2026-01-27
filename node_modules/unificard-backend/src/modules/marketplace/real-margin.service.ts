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

    // Query para consolidar receita, descontos, fees e payouts
    const query = `
      WITH order_revenue AS (
        SELECT
          oi.product_variant_id,
          o.buyer_actor_id AS actor_id,
          COALESCE(o.metadata->>'source', 'MARKETPLACE') AS channel,
          SUM(
            COALESCE(
              (oi.metadata->'priceSnapshot'->>'finalPrice')::numeric,
              (oi.metadata->>'price')::numeric,
              0
            ) * oi.quantity
          ) AS gross_revenue,
          SUM(
            COALESCE(
              (oi.metadata->'priceSnapshot'->>'discountAmount')::numeric,
              0
            )
          ) AS discounts,
          COUNT(DISTINCT o.id) AS order_count,
          COUNT(DISTINCT pt.id) AS transaction_count
        FROM order_items oi
        INNER JOIN orders o ON oi.order_id = o.id
        INNER JOIN payment_intents pi ON pi.order_id = o.id
        INNER JOIN payment_transactions pt ON pt.payment_intent_id = pi.id
        WHERE ${conditions.join(' AND ')}
          AND pt.status = 'SUCCESS'
          AND o.created_at >= $${paramIndex - 1}
          AND o.created_at <= $${paramIndex}
        GROUP BY oi.product_variant_id, o.buyer_actor_id, o.metadata->>'source'
      ),
      platform_fees AS (
        SELECT
          oi.product_variant_id,
          o.buyer_actor_id AS actor_id,
          COALESCE(o.metadata->>'source', 'MARKETPLACE') AS channel,
          SUM(ps.amount) AS platform_fees
        FROM payment_intent_splits ps
        INNER JOIN payment_intents pi ON ps.payment_intent_id = pi.id
        INNER JOIN orders o ON pi.order_id = o.id
        INNER JOIN order_items oi ON oi.order_id = o.id
        INNER JOIN payment_transactions pt ON pt.payment_intent_id = pi.id
        WHERE ps.tenant_id = $1
          AND ps.role = 'PLATFORM'
          AND pt.status = 'SUCCESS'
          AND o.created_at >= $${paramIndex - 1}
          AND o.created_at <= $${paramIndex}
          ${options.productVariantId ? `AND oi.product_variant_id = $${paramIndex - 2}` : ''}
          ${options.actorId ? `AND o.buyer_actor_id = $${paramIndex - 1}` : ''}
        GROUP BY oi.product_variant_id, o.buyer_actor_id, o.metadata->>'source'
      ),
      seller_payouts AS (
        SELECT
          oi.product_variant_id,
          o.buyer_actor_id AS actor_id,
          COALESCE(o.metadata->>'source', 'MARKETPLACE') AS channel,
          SUM(ps.amount) AS payouts
        FROM payment_intent_splits ps
        INNER JOIN payment_intents pi ON ps.payment_intent_id = pi.id
        INNER JOIN orders o ON pi.order_id = o.id
        INNER JOIN order_items oi ON oi.order_id = o.id
        INNER JOIN payment_transactions pt ON pt.payment_intent_id = pi.id
        WHERE ps.tenant_id = $1
          AND ps.role = 'SELLER'
          AND pt.status = 'SUCCESS'
          AND o.created_at >= $${paramIndex - 1}
          AND o.created_at <= $${paramIndex}
          ${options.productVariantId ? `AND oi.product_variant_id = $${paramIndex - 2}` : ''}
          ${options.actorId ? `AND o.buyer_actor_id = $${paramIndex - 1}` : ''}
        GROUP BY oi.product_variant_id, o.buyer_actor_id, o.metadata->>'source'
      )
      SELECT
        orv.product_variant_id,
        orv.actor_id,
        orv.channel,
        COALESCE(orv.gross_revenue, 0) AS gross_revenue,
        COALESCE(orv.discounts, 0) AS discounts,
        COALESCE(pf.platform_fees, 0) AS platform_fees,
        COALESCE(sp.payouts, 0) AS payouts,
        orv.order_count,
        orv.transaction_count
      FROM order_revenue orv
      LEFT JOIN platform_fees pf ON 
        orv.product_variant_id = pf.product_variant_id AND
        orv.actor_id = pf.actor_id AND
        orv.channel = pf.channel
      LEFT JOIN seller_payouts sp ON
        orv.product_variant_id = sp.product_variant_id AND
        orv.actor_id = sp.actor_id AND
        orv.channel = sp.channel
      ORDER BY orv.gross_revenue DESC
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

