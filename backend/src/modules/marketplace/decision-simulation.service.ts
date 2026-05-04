// backend/src/modules/marketplace/decision-simulation.service.ts
// SPRINT 62: SIMULADOR DE DECISÃO (WHAT-IF, READ-ONLY)
//
// SPRINT 66: HARDENING LÓGICO
// - Elasticidade movida para Policy Registry
// - Margem padrão movida para Policy Registry
// - Confidence thresholds movidos para Policy Registry

import { runQueriesWithTenant } from '@core/database/pool';
import { pricingService } from './pricing.service';
import { inventoryService } from './inventory.service';
import { inventoryHoldingCostService } from './inventory-holding-cost.service';
import { realMarginService } from './real-margin.service';
import { policyRegistry } from '@core/policy/policy-registry';
import type {
  DecisionSimulationResult,
  ConfidenceLevel,
  SimulatePriceChangeInput,
  SimulateDiscountInput,
  SimulateTransferInput,
  SimulateStockReductionInput,
  SimulationInput,
} from './decision-simulation.types';

/**
 * Service para simulação de decisões (what-if)
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - READ-ONLY: Nenhuma mutação de estado
 * - Nenhuma escrita em banco
 * - Nenhuma automação
 * - Nenhuma sugestão automática
 * - Resultado sempre explicável
 * - Usa dados históricos e médias móveis simples
 * - NÃO prever demanda com IA
 */
class DecisionSimulationService {
  /**
   * Simula mudança de preço
   * 
   * SPRINT 62: Estima impacto de mudança de preço na receita e margem
   */
  async simulatePriceChange(
    tenantId: string,
    input: SimulatePriceChangeInput
  ): Promise<DecisionSimulationResult> {
    const periodDays = input.periodDays || 30;

    // 1. Buscar preço atual
    let currentPrice = 0;
    try {
      const price = await pricingService.getCurrentPrice(tenantId, {
        variantId: input.productVariantId,
      });
      currentPrice = price.finalPrice;
    } catch (error) {
      // Se não houver preço, usar 0
      console.warn(`[Simulation] Preço não encontrado:`, error);
    }

    // 2. Buscar dados históricos (média de vendas diárias)
    const averageDailySales = await this.getAverageDailySales(
      tenantId,
      input.productVariantId,
      input.actorId,
      periodDays
    );

    // 3. Estimar impacto (simplificado: assumir elasticidade constante)
    // SPRINT 66: Elasticidade lida do Policy Registry
    const elasticity = policyRegistry.getPolicyValue<number>(
      'marketplace',
      'price_elasticity_default',
      -1.5 // default: aumento de 10% no preço = redução de 15% na demanda
    ) || -1.5;

    const priceChangePercent = ((input.newPrice - currentPrice) / currentPrice) * 100;
    const demandChangePercent = priceChangePercent * elasticity;
    const estimatedDailySales = averageDailySales * (1 + demandChangePercent / 100);

    // 4. Calcular receita estimada
    const estimatedRevenue = estimatedDailySales * input.newPrice * periodDays;

    // 5. Calcular receita atual (para comparação)
    const currentRevenue = averageDailySales * currentPrice * periodDays;

    // 6. Estimar margem (usar margem histórica média)
    const historicalMargin = await this.getHistoricalMargin(
      tenantId,
      input.productVariantId,
      input.actorId
    );
    const estimatedMargin = estimatedRevenue * (historicalMargin.marginPercentage / 100);
    const currentMargin = currentRevenue * (historicalMargin.marginPercentage / 100);

    // 7. Estimar holding cost (se estoque aumentar)
    const currentStock = await this.getCurrentStock(tenantId, input.productVariantId, input.actorId);
    const estimatedStockAfter = currentStock; // Preço não afeta estoque diretamente
    const estimatedHoldingCost = await this.estimateHoldingCost(
      tenantId,
      input.productVariantId,
      input.actorId,
      estimatedStockAfter
    );
    const currentHoldingCost = await this.estimateHoldingCost(
      tenantId,
      input.productVariantId,
      input.actorId,
      currentStock
    );

    // 8. Determinar nível de confiança
    const confidenceLevel = this.determineConfidenceLevel(averageDailySales, periodDays);

    // 9. Gerar explicação
    const explanation = this.generatePriceChangeExplanation(
      currentPrice,
      input.newPrice,
      priceChangePercent,
      averageDailySales,
      estimatedDailySales,
      currentRevenue,
      estimatedRevenue,
      currentMargin,
      estimatedMargin,
      periodDays
    );

    return {
      scenarioType: 'PRICE_CHANGE',
      inputParameters: {
        productVariantId: input.productVariantId,
        actorId: input.actorId,
        newPrice: input.newPrice,
        periodDays,
      },
      estimatedRevenue,
      estimatedMargin,
      estimatedHoldingCost,
      estimatedStockAfter,
      deltaVsCurrent: {
        revenue: estimatedRevenue - currentRevenue,
        margin: estimatedMargin - currentMargin,
        holdingCost: estimatedHoldingCost - currentHoldingCost,
        stock: estimatedStockAfter - currentStock,
      },
      explanation,
      confidenceLevel,
      metadata: {
        historicalDataPoints: periodDays,
        averageDailySales,
        currentPrice,
        currentStock,
        priceChangePercent,
        demandChangePercent,
        elasticity,
      },
    };
  }

  /**
   * Simula aplicação de desconto
   */
  async simulateDiscount(
    tenantId: string,
    input: SimulateDiscountInput
  ): Promise<DecisionSimulationResult> {
    const periodDays = input.periodDays || 30;

    // 1. Buscar preço atual
    let currentPrice = 0;
    try {
      const price = await pricingService.getCurrentPrice(tenantId, {
        variantId: input.productVariantId,
      });
      currentPrice = price.finalPrice;
    } catch (error) {
      console.warn(`[Simulation] Preço não encontrado:`, error);
    }

    // 2. Calcular novo preço com desconto
    let newPrice = currentPrice;
    if (input.discountBps !== undefined) {
      newPrice = currentPrice * (1 - input.discountBps / 100);
    } else if (input.discountAmount !== undefined) {
      newPrice = currentPrice - input.discountAmount;
    }

    // 3. Usar mesma lógica de price change
    return await this.simulatePriceChange(tenantId, {
      productVariantId: input.productVariantId,
      actorId: input.actorId,
      newPrice,
      periodDays,
    });
  }

  /**
   * Simula transferência de estoque
   */
  async simulateTransfer(
    tenantId: string,
    input: SimulateTransferInput
  ): Promise<DecisionSimulationResult> {
    // 1. Buscar estoque atual nas filiais
    const fromStock = await this.getCurrentStock(tenantId, input.productVariantId, input.fromActorId);
    const toStock = await this.getCurrentStock(tenantId, input.productVariantId, input.toActorId);

    // 2. Validar se há estoque suficiente
    if (fromStock < input.quantity) {
      throw new Error(`Estoque insuficiente na filial origem: ${fromStock} < ${input.quantity}`);
    }

    // 3. Estimar estoque após transferência
    const estimatedFromStock = fromStock - input.quantity;
    const estimatedToStock = toStock + input.quantity;

    // 4. Estimar holding cost após transferência
    const currentHoldingCostFrom = await this.estimateHoldingCost(
      tenantId,
      input.productVariantId,
      input.fromActorId,
      fromStock
    );
    const currentHoldingCostTo = await this.estimateHoldingCost(
      tenantId,
      input.productVariantId,
      input.toActorId,
      toStock
    );
    const estimatedHoldingCostFrom = await this.estimateHoldingCost(
      tenantId,
      input.productVariantId,
      input.fromActorId,
      estimatedFromStock
    );
    const estimatedHoldingCostTo = await this.estimateHoldingCost(
      tenantId,
      input.productVariantId,
      input.toActorId,
      estimatedToStock
    );

    const totalCurrentHoldingCost = currentHoldingCostFrom + currentHoldingCostTo;
    const totalEstimatedHoldingCost = estimatedHoldingCostFrom + estimatedHoldingCostTo;

    // 5. Gerar explicação
    const explanation = this.generateTransferExplanation(
      input.fromActorId,
      input.toActorId,
      fromStock,
      toStock,
      input.quantity,
      estimatedFromStock,
      estimatedToStock,
      totalCurrentHoldingCost,
      totalEstimatedHoldingCost
    );

    return {
      scenarioType: 'TRANSFER',
      inputParameters: {
        productVariantId: input.productVariantId,
        fromActorId: input.fromActorId,
        toActorId: input.toActorId,
        quantity: input.quantity,
      },
      estimatedRevenue: 0, // Transferência não gera receita
      estimatedMargin: 0, // Transferência não gera margem
      estimatedHoldingCost: totalEstimatedHoldingCost,
      estimatedStockAfter: estimatedToStock, // Estoque na filial destino
      deltaVsCurrent: {
        revenue: 0,
        margin: 0,
        holdingCost: totalEstimatedHoldingCost - totalCurrentHoldingCost,
        stock: input.quantity, // Diferença na filial destino
      },
      explanation,
      confidenceLevel: 'HIGH', // Transferência é determinística
      metadata: {
        fromStock,
        toStock,
        estimatedFromStock,
        estimatedToStock,
        currentHoldingCostFrom,
        currentHoldingCostTo,
        estimatedHoldingCostFrom,
        estimatedHoldingCostTo,
      },
    };
  }

  /**
   * Simula redução de estoque (ajuste)
   */
  async simulateStockReduction(
    tenantId: string,
    input: SimulateStockReductionInput
  ): Promise<DecisionSimulationResult> {
    // 1. Buscar estoque atual
    const currentStock = await this.getCurrentStock(tenantId, input.productVariantId, input.actorId);

    // 2. Validar se há estoque suficiente
    if (currentStock < input.reductionQuantity) {
      throw new Error(`Estoque insuficiente: ${currentStock} < ${input.reductionQuantity}`);
    }

    // 3. Estimar estoque após redução
    const estimatedStockAfter = currentStock - input.reductionQuantity;

    // 4. Estimar holding cost após redução
    const currentHoldingCost = await this.estimateHoldingCost(
      tenantId,
      input.productVariantId,
      input.actorId,
      currentStock
    );
    const estimatedHoldingCost = await this.estimateHoldingCost(
      tenantId,
      input.productVariantId,
      input.actorId,
      estimatedStockAfter
    );

    // 5. Gerar explicação
    const explanation = this.generateStockReductionExplanation(
      input.reductionType,
      currentStock,
      input.reductionQuantity,
      estimatedStockAfter,
      currentHoldingCost,
      estimatedHoldingCost
    );

    return {
      scenarioType: 'REDUCE_STOCK',
      inputParameters: {
        productVariantId: input.productVariantId,
        actorId: input.actorId,
        reductionQuantity: input.reductionQuantity,
        reductionType: input.reductionType,
      },
      estimatedRevenue: 0, // Redução não gera receita
      estimatedMargin: 0, // Redução não gera margem
      estimatedHoldingCost,
      estimatedStockAfter,
      deltaVsCurrent: {
        revenue: 0,
        margin: 0,
        holdingCost: estimatedHoldingCost - currentHoldingCost,
        stock: -input.reductionQuantity, // Redução negativa
      },
      explanation,
      confidenceLevel: 'HIGH', // Redução é determinística
      metadata: {
        currentStock,
        reductionQuantity: input.reductionQuantity,
        reductionType: input.reductionType,
      },
    };
  }

  /**
   * Executa simulação genérica
   */
  async simulate(
    tenantId: string,
    input: SimulationInput
  ): Promise<DecisionSimulationResult> {
    switch (input.scenarioType) {
      case 'PRICE_CHANGE':
        return await this.simulatePriceChange(tenantId, input.parameters as SimulatePriceChangeInput);
      case 'DISCOUNT':
        return await this.simulateDiscount(tenantId, input.parameters as SimulateDiscountInput);
      case 'TRANSFER':
        return await this.simulateTransfer(tenantId, input.parameters as SimulateTransferInput);
      case 'REDUCE_STOCK':
        return await this.simulateStockReduction(tenantId, input.parameters as SimulateStockReductionInput);
      default:
        throw new Error(`Tipo de cenário não suportado: ${input.scenarioType}`);
    }
  }

  /**
   * Busca média de vendas diárias (histórico)
   */
  private async getAverageDailySales(
    tenantId: string,
    productVariantId: string,
    actorId?: string,
    periodDays: number = 30
  ): Promise<number> {
    const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    const periodEnd = new Date();

    const conditions: string[] = [
      'o.tenant_id = $1',
      'oi.product_variant_id = $2',
      'o.status = \'SUBMITTED\'',
      'pt.status = \'SUCCESS\'',
    ];
    const params: any[] = [tenantId, productVariantId];
    let paramIndex = 3;

    if (actorId) {
      conditions.push(`o.buyer_actor_id = $${paramIndex}`);
      params.push(actorId);
      paramIndex++;
    }

    params.push(periodStart, periodEnd);

    const query = `
      SELECT
        SUM(oi.quantity) AS total_quantity,
        COUNT(DISTINCT DATE(o.created_at)) AS days_with_sales
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.id
      INNER JOIN payment_intents pi ON pi.order_id = o.id
      INNER JOIN payment_transactions pt ON pt.payment_intent_id = pi.id
      WHERE ${conditions.join(' AND ')}
        AND o.created_at >= $${paramIndex - 1}
        AND o.created_at <= $${paramIndex}
    `;

    const rows = await runQueriesWithTenant<any>(tenantId, query, params);
    const row = rows[0];

    if (!row || !row.total_quantity || !row.days_with_sales || row.days_with_sales === 0) {
      return 0; // Sem histórico de vendas
    }

    const totalQuantity = parseFloat(row.total_quantity);
    const daysWithSales = parseInt(row.days_with_sales);
    return totalQuantity / daysWithSales; // Média diária
  }

  /**
   * Busca margem histórica média
   */
  private async getHistoricalMargin(
    tenantId: string,
    productVariantId: string,
    actorId?: string
  ): Promise<{ marginPercentage: number }> {
    try {
      const margins = await realMarginService.getMarginByVariant(tenantId, {
        productVariantId,
        actorId,
        limit: 1,
      });

      if (margins.length > 0) {
        return { marginPercentage: margins[0].marginPercentage };
      }
    } catch (error) {
      console.warn(`[Simulation] Erro ao buscar margem histórica:`, error);
    }

    // SPRINT 66: Margem padrão lida do Policy Registry
    const defaultMargin = policyRegistry.getPolicyValue<number>(
      'marketplace',
      'default_margin_percentage',
      15 // default: 15%
    ) || 15;

    return { marginPercentage: defaultMargin };
  }

  /**
   * Busca estoque atual
   */
  private async getCurrentStock(
    tenantId: string,
    productVariantId: string,
    actorId?: string
  ): Promise<number> {
    try {
      const balance = await inventoryService.getCurrentBalance(tenantId, productVariantId);
      return balance.quantity;
    } catch (error) {
      console.warn(`[Simulation] Erro ao buscar estoque:`, error);
      return 0;
    }
  }

  /**
   * Estima holding cost para um estoque específico
   */
  private async estimateHoldingCost(
    tenantId: string,
    productVariantId: string,
    actorId: string | undefined,
    stockQuantity: number
  ): Promise<number> {
    try {
      // Buscar preço atual
      let unitCost = 0;
      try {
        const price = await pricingService.getCurrentPrice(tenantId, {
          variantId: productVariantId,
        });
        unitCost = price.finalPrice;
      } catch (error) {
        // Se não houver preço, usar 0
      }

      // Buscar aging médio
      const aging = await inventoryService.getCurrentBalance(tenantId, productVariantId);
      // TODO: Buscar aging real via inventorySlaService
      const averageAgingDays = 30; // Padrão

      // Calcular holding cost estimado
      const dailyHoldingRate = 0.001; // 0.1% ao dia
      return stockQuantity * unitCost * averageAgingDays * dailyHoldingRate;
    } catch (error) {
      console.warn(`[Simulation] Erro ao estimar holding cost:`, error);
      return 0;
    }
  }

  /**
   * Determina nível de confiança baseado em dados históricos
   */
  private determineConfidenceLevel(
    averageDailySales: number,
    historicalDataPoints: number
  ): ConfidenceLevel {
    // SPRINT 66: Thresholds lidos do Policy Registry
    const lowThreshold = policyRegistry.getPolicyValue<number>(
      'marketplace',
      'confidence_min_data_points_low',
      7
    ) || 7;

    const mediumThreshold = policyRegistry.getPolicyValue<number>(
      'marketplace',
      'confidence_min_data_points_medium',
      30
    ) || 30;

    if (averageDailySales === 0 || historicalDataPoints < lowThreshold) {
      return 'LOW';
    } else if (historicalDataPoints < mediumThreshold) {
      return 'MEDIUM';
    } else {
      return 'HIGH';
    }
  }

  /**
   * Gera explicação para mudança de preço
   */
  private generatePriceChangeExplanation(
    currentPrice: number,
    newPrice: number,
    priceChangePercent: number,
    averageDailySales: number,
    estimatedDailySales: number,
    currentRevenue: number,
    estimatedRevenue: number,
    currentMargin: number,
    estimatedMargin: number,
    periodDays: number
  ): string {
    const parts: string[] = [];

    parts.push(`Cenário: Mudança de preço de R$ ${currentPrice.toFixed(2)} para R$ ${newPrice.toFixed(2)} (${priceChangePercent > 0 ? '+' : ''}${priceChangePercent.toFixed(1)}%)`);
    parts.push(`Período: ${periodDays} dias`);
    parts.push(`Média histórica de vendas: ${averageDailySales.toFixed(2)} unidades/dia`);
    parts.push(`Vendas estimadas: ${estimatedDailySales.toFixed(2)} unidades/dia`);
    parts.push(`Receita atual estimada: R$ ${currentRevenue.toFixed(2)}`);
    parts.push(`Receita estimada: R$ ${estimatedRevenue.toFixed(2)}`);
    parts.push(`Margem atual estimada: R$ ${currentMargin.toFixed(2)}`);
    parts.push(`Margem estimada: R$ ${estimatedMargin.toFixed(2)}`);
    parts.push(`Diferença: R$ ${(estimatedRevenue - currentRevenue).toFixed(2)} (${((estimatedRevenue - currentRevenue) / currentRevenue * 100).toFixed(1)}%)`);

    return parts.join(' | ');
  }

  /**
   * Gera explicação para transferência
   */
  private generateTransferExplanation(
    fromActorId: string,
    toActorId: string,
    fromStock: number,
    toStock: number,
    quantity: number,
    estimatedFromStock: number,
    estimatedToStock: number,
    currentHoldingCost: number,
    estimatedHoldingCost: number
  ): string {
    const parts: string[] = [];

    parts.push(`Cenário: Transferência de ${quantity} unidades de ${fromActorId} para ${toActorId}`);
    parts.push(`Estoque origem: ${fromStock} → ${estimatedFromStock}`);
    parts.push(`Estoque destino: ${toStock} → ${estimatedToStock}`);
    parts.push(`Custo estoque parado atual: R$ ${currentHoldingCost.toFixed(2)}`);
    parts.push(`Custo estoque parado estimado: R$ ${estimatedHoldingCost.toFixed(2)}`);
    parts.push(`Diferença: R$ ${(estimatedHoldingCost - currentHoldingCost).toFixed(2)}`);

    return parts.join(' | ');
  }

  /**
   * Gera explicação para redução de estoque
   */
  private generateStockReductionExplanation(
    reductionType: 'LOSS' | 'DAMAGE' | 'SURPLUS',
    currentStock: number,
    reductionQuantity: number,
    estimatedStockAfter: number,
    currentHoldingCost: number,
    estimatedHoldingCost: number
  ): string {
    const parts: string[] = [];

    const typeNames: Record<string, string> = {
      LOSS: 'Perda',
      DAMAGE: 'Avaria',
      SURPLUS: 'Sobra',
    };

    parts.push(`Cenário: Redução de estoque (${typeNames[reductionType]})`);
    parts.push(`Estoque atual: ${currentStock} unidades`);
    parts.push(`Redução: ${reductionQuantity} unidades`);
    parts.push(`Estoque após: ${estimatedStockAfter} unidades`);
    parts.push(`Custo estoque parado atual: R$ ${currentHoldingCost.toFixed(2)}`);
    parts.push(`Custo estoque parado estimado: R$ ${estimatedHoldingCost.toFixed(2)}`);
    parts.push(`Economia estimada: R$ ${(currentHoldingCost - estimatedHoldingCost).toFixed(2)}`);

    return parts.join(' | ');
  }
}

export const decisionSimulationService = new DecisionSimulationService();


