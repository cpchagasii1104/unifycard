// backend/src/modules/marketplace/pricing-strategy.service.ts
// SPRINT 63: ESTRATÉGIA DE PREÇO ASSISTIDA (READ-ONLY)
//
// SPRINT 66: HARDENING LÓGICO
// - Elasticidade movida para Policy Registry

import { pricingService } from './pricing.service';
import { realMarginService } from './real-margin.service';
import { decisionSimulationService } from './decision-simulation.service';
import { inventoryService } from './inventory.service';
import { inventorySlaService } from './inventory-sla.service';
import { inventoryHoldingCostService } from './inventory-holding-cost.service';
import { policyRegistry } from '@core/policy/policy-registry';
import type {
  PricingStrategyInsight,
  GetPricingStrategyOptions,
} from './pricing-strategy.types';
import type { ConfidenceLevel } from './decision-simulation.types';

/**
 * Service para estratégia de preço assistida
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - READ-ONLY: Nenhuma mutação de estado
 * - NÃO aplica preço
 * - NÃO cria promoção
 * - NÃO sugere valor único (sempre faixa)
 * - Estratégia = informação, não ação
 * - Usa simulações existentes
 * - Usa margem real
 * - Usa holding cost
 */
class PricingStrategyService {
  /**
   * Obtém estratégia de preço para um produto
   * 
   * SPRINT 63: Analisa preço atual, margem, holding cost e demanda
   * para sugerir faixa de preço, sem aplicar nada
   */
  async getPriceStrategy(
    tenantId: string,
    options: GetPricingStrategyOptions
  ): Promise<PricingStrategyInsight> {
    const priceRangeSteps = options.priceRangeSteps || 5;
    const simulationPeriodDays = options.simulationPeriodDays || 30;

    // 1. Buscar preço atual
    let currentPrice = 0;
    try {
      const price = await pricingService.getCurrentPrice(tenantId, {
        variantId: options.productVariantId,
      });
      currentPrice = price.finalPrice;
    } catch (error) {
      throw new Error(`Preço não encontrado para variante: ${options.productVariantId}`);
    }

    // 2. Buscar margem atual
    const currentMargin = await this.getCurrentMargin(
      tenantId,
      options.productVariantId,
      options.actorId
    );

    // 3. Buscar holding cost atual
    const currentHoldingCost = await this.getCurrentHoldingCost(
      tenantId,
      options.productVariantId,
      options.actorId
    );

    // 4. Buscar dados históricos
    const historicalData = await this.getHistoricalData(
      tenantId,
      options.productVariantId,
      options.actorId
    );

    // 5. Calcular faixa de preço sugerida
    const priceRange = this.calculatePriceRange(
      currentPrice,
      historicalData.averageDailySales,
      historicalData.elasticity
    );

    // 6. Gerar simulações para diferentes preços na faixa
    const scenarios = await this.generateScenarios(
      tenantId,
      options.productVariantId,
      options.actorId,
      currentPrice,
      priceRange,
      priceRangeSteps,
      simulationPeriodDays
    );

    // 7. Calcular impacto na margem para cada extremo da faixa
    const marginImpact = await this.calculateMarginImpact(
      tenantId,
      options.productVariantId,
      options.actorId,
      currentPrice,
      currentMargin,
      priceRange,
      scenarios
    );

    // 8. Calcular impacto no holding cost
    const holdingCostImpact = await this.calculateHoldingCostImpact(
      tenantId,
      options.productVariantId,
      options.actorId,
      currentHoldingCost,
      priceRange,
      scenarios
    );

    // 9. Calcular sensibilidade da demanda
    const demandSensitivity = this.calculateDemandSensitivity(
      historicalData.elasticity,
      currentPrice
    );

    // 10. Determinar nível de confiança
    const confidenceLevel = this.determineConfidenceLevel(
      historicalData.dataPoints,
      historicalData.averageDailySales
    );

    // 11. Gerar explicação
    const explanation = this.generateExplanation(
      currentPrice,
      priceRange,
      currentMargin,
      marginImpact,
      currentHoldingCost,
      holdingCostImpact,
      demandSensitivity,
      confidenceLevel
    );

    return {
      productVariantId: options.productVariantId,
      actorId: options.actorId,
      channel: options.channel,
      currentPrice,
      suggestedPriceRange: {
        min: priceRange.min,
        max: priceRange.max,
        optimal: priceRange.optimal,
      },
      marginImpact: {
        currentMargin,
        minMargin: marginImpact.minMargin,
        maxMargin: marginImpact.maxMargin,
        optimalMargin: marginImpact.optimalMargin,
      },
      holdingCostImpact: {
        currentHoldingCost,
        estimatedHoldingCostAtMin: holdingCostImpact.atMin,
        estimatedHoldingCostAtMax: holdingCostImpact.atMax,
      },
      demandSensitivity,
      scenarios,
      explanation,
      confidenceLevel,
      metadata: {
        historicalDataPoints: historicalData.dataPoints,
        averageDailySales: historicalData.averageDailySales,
        currentStock: historicalData.currentStock,
        daysInStock: historicalData.daysInStock,
      },
    };
  }

  /**
   * Busca margem atual
   */
  private async getCurrentMargin(
    tenantId: string,
    productVariantId: string,
    actorId?: string
  ): Promise<number> {
    try {
      const margins = await realMarginService.getMarginByVariant(tenantId, {
        productVariantId,
        actorId,
        limit: 1,
      });

      if (margins.length > 0) {
        return margins[0].netMargin;
      }
    } catch (error) {
      console.warn(`[PricingStrategy] Erro ao buscar margem:`, error);
    }

    return 0;
  }

  /**
   * Busca holding cost atual
   */
  private async getCurrentHoldingCost(
    tenantId: string,
    productVariantId: string,
    actorId?: string
  ): Promise<number> {
    try {
      const holdingCosts = await inventoryHoldingCostService.getHoldingCosts(
        tenantId,
        {
          productVariantId,
          actorId,
        }
      );

      if (holdingCosts.length > 0) {
        return holdingCosts[0].totalHoldingCost;
      }
    } catch (error) {
      console.warn(`[PricingStrategy] Erro ao buscar holding cost:`, error);
    }

    return 0;
  }

  /**
   * Busca dados históricos
   */
  private async getHistoricalData(
    tenantId: string,
    productVariantId: string,
    actorId?: string
  ): Promise<{
    averageDailySales: number;
    elasticity: number;
    dataPoints: number;
    currentStock: number;
    daysInStock: number;
  }> {
    // Buscar média de vendas diárias (últimos 30 dias)
    let averageDailySales = 0;
    let dataPoints = 0;

    try {
      const periodStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const periodEnd = new Date();

      // Usar query similar ao decision-simulation
      const { runQueriesWithTenant } = await import('@core/database/pool');
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

      if (row && row.total_quantity && row.days_with_sales && row.days_with_sales > 0) {
        averageDailySales = parseFloat(row.total_quantity) / parseInt(row.days_with_sales);
        dataPoints = parseInt(row.days_with_sales);
      }
    } catch (error) {
      console.warn(`[PricingStrategy] Erro ao buscar dados históricos:`, error);
    }

    // Buscar estoque atual
    let currentStock = 0;
    try {
      const balance = await inventoryService.getCurrentBalance(tenantId, productVariantId);
      currentStock = balance.quantity;
    } catch (error) {
      console.warn(`[PricingStrategy] Erro ao buscar estoque:`, error);
    }

    // Buscar aging
    let daysInStock = 0;
    try {
      const aging = await inventorySlaService.getStockAging(tenantId, {
        productVariantId,
        limit: 1,
      });
      if (aging.length > 0) {
        daysInStock = aging[0].daysInStock;
      }
    } catch (error) {
      console.warn(`[PricingStrategy] Erro ao buscar aging:`, error);
    }

    // SPRINT 66: Elasticidade lida do Policy Registry
    const elasticity = policyRegistry.getPolicyValue<number>(
      'marketplace',
      'price_elasticity_default',
      -1.5 // default
    ) || -1.5;

    return {
      averageDailySales,
      elasticity,
      dataPoints,
      currentStock,
      daysInStock,
    };
  }

  /**
   * Calcula faixa de preço sugerida
   */
  private calculatePriceRange(
    currentPrice: number,
    averageDailySales: number,
    elasticity: number
  ): { min: number; max: number; optimal?: number } {
    // Faixa baseada em percentuais do preço atual
    // Min: -20% (aumenta demanda)
    // Max: +20% (reduz demanda)
    const min = currentPrice * 0.8;
    const max = currentPrice * 1.2;

    // Preço ótimo: tenta maximizar receita
    // Receita = Preço * Demanda
    // Demanda = DemandaAtual * (1 + (VariaçãoPreço * Elasticidade))
    // Receita = Preço * DemandaAtual * (1 + ((Preço - PreçoAtual) / PreçoAtual * Elasticidade))
    // Derivando e igualando a zero, obtemos o preço ótimo
    // Para elasticidade -1.5, o preço ótimo é aproximadamente +10% do atual
    const optimal = currentPrice * 1.1;

    return {
      min: Math.max(min, currentPrice * 0.5), // Não menos que 50% do atual
      max: Math.min(max, currentPrice * 2.0), // Não mais que 200% do atual
      optimal: Math.max(min, Math.min(optimal, max)), // Dentro da faixa
    };
  }

  /**
   * Gera simulações para diferentes preços
   */
  private async generateScenarios(
    tenantId: string,
    productVariantId: string,
    actorId: string | undefined,
    currentPrice: number,
    priceRange: { min: number; max: number; optimal?: number },
    steps: number,
    periodDays: number
  ): Promise<any[]> {
    const scenarios: any[] = [];

    // Simular preços na faixa
    const priceStep = (priceRange.max - priceRange.min) / (steps - 1);
    const pricesToSimulate = [
      priceRange.min,
      ...(priceRange.optimal ? [priceRange.optimal] : []),
      priceRange.max,
    ];

    // Adicionar preços intermediários
    for (let i = 1; i < steps - 1; i++) {
      const price = priceRange.min + priceStep * i;
      if (!pricesToSimulate.includes(price)) {
        pricesToSimulate.push(price);
      }
    }

    pricesToSimulate.sort((a, b) => a - b);

    // Simular cada preço
    for (const price of pricesToSimulate) {
      try {
        const simulation = await decisionSimulationService.simulatePriceChange(tenantId, {
          productVariantId,
          actorId,
          newPrice: price,
          periodDays,
        });
        scenarios.push(simulation);
      } catch (error) {
        console.warn(`[PricingStrategy] Erro ao simular preço ${price}:`, error);
      }
    }

    return scenarios;
  }

  /**
   * Calcula impacto na margem
   */
  private async calculateMarginImpact(
    tenantId: string,
    productVariantId: string,
    actorId: string | undefined,
    currentPrice: number,
    currentMargin: number,
    priceRange: { min: number; max: number; optimal?: number },
    scenarios: any[]
  ): Promise<{
    minMargin: number;
    maxMargin: number;
    optimalMargin?: number;
  }> {
    // Buscar margens das simulações
    const minScenario = scenarios.find((s) => Math.abs(s.inputParameters.newPrice - priceRange.min) < 0.01);
    const maxScenario = scenarios.find((s) => Math.abs(s.inputParameters.newPrice - priceRange.max) < 0.01);
    const optimalScenario = priceRange.optimal
      ? scenarios.find((s) => Math.abs(s.inputParameters.newPrice - priceRange.optimal!) < 0.01)
      : null;

    return {
      minMargin: minScenario?.estimatedMargin || currentMargin * 0.8,
      maxMargin: maxScenario?.estimatedMargin || currentMargin * 1.2,
      optimalMargin: optimalScenario?.estimatedMargin,
    };
  }

  /**
   * Calcula impacto no holding cost
   */
  private async calculateHoldingCostImpact(
    tenantId: string,
    productVariantId: string,
    actorId: string | undefined,
    currentHoldingCost: number,
    priceRange: { min: number; max: number; optimal?: number },
    scenarios: any[]
  ): Promise<{
    atMin: number;
    atMax: number;
  }> {
    // Buscar holding costs das simulações
    const minScenario = scenarios.find((s) => Math.abs(s.inputParameters.newPrice - priceRange.min) < 0.01);
    const maxScenario = scenarios.find((s) => Math.abs(s.inputParameters.newPrice - priceRange.max) < 0.01);

    return {
      atMin: minScenario?.estimatedHoldingCost || currentHoldingCost,
      atMax: maxScenario?.estimatedHoldingCost || currentHoldingCost,
    };
  }

  /**
   * Calcula sensibilidade da demanda
   */
  private calculateDemandSensitivity(
    elasticity: number,
    currentPrice: number
  ): {
    elasticity: number;
    priceChangeImpact: {
      minus10Percent: number;
      minus5Percent: number;
      plus5Percent: number;
      plus10Percent: number;
    };
  } {
    // Variação de demanda = Variação de preço * Elasticidade
    return {
      elasticity,
      priceChangeImpact: {
        minus10Percent: -10 * elasticity, // Ex: -10% * -1.5 = +15% de demanda
        minus5Percent: -5 * elasticity, // Ex: -5% * -1.5 = +7.5% de demanda
        plus5Percent: 5 * elasticity, // Ex: +5% * -1.5 = -7.5% de demanda
        plus10Percent: 10 * elasticity, // Ex: +10% * -1.5 = -15% de demanda
      },
    };
  }

  /**
   * Determina nível de confiança
   */
  private determineConfidenceLevel(
    dataPoints: number,
    averageDailySales: number
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

    if (averageDailySales === 0 || dataPoints < lowThreshold) {
      return 'LOW';
    } else if (dataPoints < mediumThreshold) {
      return 'MEDIUM';
    } else {
      return 'HIGH';
    }
  }

  /**
   * Gera explicação da estratégia
   */
  private generateExplanation(
    currentPrice: number,
    priceRange: { min: number; max: number; optimal?: number },
    currentMargin: number,
    marginImpact: { minMargin: number; maxMargin: number; optimalMargin?: number },
    currentHoldingCost: number,
    holdingCostImpact: { atMin: number; atMax: number },
    demandSensitivity: any,
    confidenceLevel: ConfidenceLevel
  ): string {
    const parts: string[] = [];

    parts.push(`Preço atual: R$ ${currentPrice.toFixed(2)}`);
    parts.push(`Faixa sugerida: R$ ${priceRange.min.toFixed(2)} - R$ ${priceRange.max.toFixed(2)}`);
    if (priceRange.optimal) {
      parts.push(`Preço ótimo estimado: R$ ${priceRange.optimal.toFixed(2)}`);
    }
    parts.push(`Margem atual: R$ ${currentMargin.toFixed(2)}`);
    parts.push(`Margem na faixa: R$ ${marginImpact.minMargin.toFixed(2)} - R$ ${marginImpact.maxMargin.toFixed(2)}`);
    if (marginImpact.optimalMargin) {
      parts.push(`Margem ótima estimada: R$ ${marginImpact.optimalMargin.toFixed(2)}`);
    }
    parts.push(`Custo estoque atual: R$ ${currentHoldingCost.toFixed(2)}`);
    parts.push(`Sensibilidade: ${demandSensitivity.priceChangeImpact.minus10Percent.toFixed(1)}% a ${demandSensitivity.priceChangeImpact.plus10Percent.toFixed(1)}% de variação de demanda`);
    parts.push(`Confiança: ${confidenceLevel}`);

    return parts.join(' | ');
  }
}

export const pricingStrategyService = new PricingStrategyService();


