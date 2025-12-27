// src/core/catalog/dynamic-pricing/dynamic-pricing.service.ts
// Serviço de simulação de preço dinâmico - READ-ONLY

import { runQueryWithTenant, runQueriesWithTenant } from '../../database/pool';
import { decisionLogService } from '../../decision-log/decision-log.service';
import { productDemandService } from '../product-demand/product-demand.service';
import { cityReadinessService } from '../../city/city-readiness/city-readiness.service';
import type {
  DynamicPricingSimulation,
  CityDynamicPricingResult,
} from './dynamic-pricing.types';

interface ProductOfferRow {
  id: string;
  product_id: string;
  merchant_id: string;
  price: string;
  active: boolean;
}

/**
 * Serviço de simulação de preço dinâmico
 * READ-ONLY: apenas simula, não executa mudanças de preço
 */
class DynamicPricingService {
  /**
   * Simula preços dinâmicos para todos os produtos de uma cidade
   */
  async simulateCityDynamicPricing(
    tenantId: string,
    cityId: string
  ): Promise<CityDynamicPricingResult | null> {
    // Guardrail informativo: verificar readiness (não bloqueia, apenas avisa)
    try {
      const readiness = await cityReadinessService.getCityReadiness(cityId);
      if (readiness && !readiness.canActivate.marketplace) {
        console.warn(
          `[DynamicPricingService] Cidade ${cityId} não está pronta para marketplace:`,
          readiness.reasons.marketplace || ['Dependências faltantes']
        );
      }
    } catch (error) {
      // Não falhar silenciosamente - log o erro mas continua
      console.warn(
        '[DynamicPricingService] Erro ao verificar city readiness:',
        error
      );
    }

    // Obter sinais de demanda da cidade
    const demandSignals = await productDemandService.getCityDemandSignals(
      tenantId,
      cityId
    );

    if (!demandSignals || demandSignals.signals.length === 0) {
      return null;
    }

    const simulations: DynamicPricingSimulation[] = [];

    for (const signal of demandSignals.signals) {
      const simulation = await this.simulateProductPricing(
        tenantId,
        cityId,
        signal.productId,
        signal
      );

      if (simulation) {
        simulations.push(simulation);
      }
    }

    // Calcular estatísticas (apenas simulações com dados suficientes)
    const validSimulations = simulations.filter(
      (s) => s.simulatedPrice !== null && s.priceChange !== null
    );
    const productsWithPriceIncrease = validSimulations.filter(
      (s) => s.priceChange! > 0
    ).length;
    const productsWithPriceDecrease = validSimulations.filter(
      (s) => s.priceChange! < 0
    ).length;
    const totalPriceImpact = validSimulations.reduce(
      (sum, s) => sum + Math.abs(s.priceChange!),
      0
    );

    const result: CityDynamicPricingResult = {
      cityId,
      simulations,
      totalProducts: simulations.length,
      productsWithPriceIncrease,
      productsWithPriceDecrease,
      totalPriceImpact,
      computedAt: new Date().toISOString(),
    };

    // Log estruturado (observação)
    await this.logPricingSimulation(tenantId, cityId, result);

    return result;
  }

  /**
   * Simula preço dinâmico para um produto específico
   */
  async simulateProductPricing(
    tenantId: string,
    cityId: string,
    productId: string,
    demandSignal?: {
      demandIndex: number;
      supplyIndex: number;
      demandSupplyRatio: number;
      searchesLast7Days: number;
      offersCount: number;
      confidence?: 'high' | 'medium' | 'low' | 'insufficient';
      sampleSize?: number;
      dataWindowDays?: number;
      reason?: string;
    }
  ): Promise<DynamicPricingSimulation | null> {
    // Obter sinal de demanda se não fornecido
    let signal = demandSignal;
    if (!signal) {
      const demandSignalResult =
        await productDemandService.getProductDemandSignal(
          tenantId,
          cityId,
          productId
        );
      if (!demandSignalResult) {
        return null;
      }
      signal = demandSignalResult;
    }

    // Obter preço médio atual das ofertas do produto na cidade
    const currentPrice = await this.getAveragePrice(tenantId, cityId, productId);
    if (!currentPrice || currentPrice === 0) {
      return null; // Sem ofertas ativas, não há preço para simular
    }

    // Blindagem semântica: validar confidence antes de calcular
    const signalConfidence = signal.confidence || 'insufficient';
    
    let simulatedPrice: number | null = null;
    let priceChange: number | null = null;
    let priceChangePercent: number | null = null;
    let adjustmentReason: string;
    let simulationConfidence: 'high' | 'medium' | 'low' | 'insufficient';

    if (signalConfidence === 'insufficient') {
      // Dados insuficientes: não calcular simulação
      adjustmentReason = `Dados insuficientes para simulação confiável${signal.reason ? `: ${signal.reason}` : ''}`;
      simulationConfidence = 'insufficient';
    } else {
      // Calcular preço simulado baseado em demanda/oferta
      simulatedPrice = this.calculateDynamicPrice(
        currentPrice,
        signal.demandIndex,
        signal.supplyIndex,
        signal.demandSupplyRatio
      );

      priceChange = simulatedPrice - currentPrice;
      priceChangePercent =
        currentPrice > 0 ? (priceChange / currentPrice) * 100 : 0;

      // Determinar motivo do ajuste
      const baseReason = this.getAdjustmentReason(
        signal.demandSupplyRatio,
        priceChangePercent
      );

      // Adicionar aviso de baixa confiança se necessário
      if (signalConfidence === 'low') {
        adjustmentReason = `[Baixa confiança] ${baseReason}`;
        simulationConfidence = 'low';
      } else {
        adjustmentReason = baseReason;
        simulationConfidence = signalConfidence;
      }
    }

    const simulation: DynamicPricingSimulation = {
      productId,
      cityId,
      currentPrice,
      simulatedPrice,
      priceChange,
      priceChangePercent,
      demandIndex: signal.demandIndex,
      supplyIndex: signal.supplyIndex,
      demandSupplyRatio: signal.demandSupplyRatio,
      adjustmentReason,
      computedAt: new Date().toISOString(),
      simulationConfidence,
    };

    // Log estruturado (observação)
    await this.logProductPricing(tenantId, cityId, productId, simulation);

    return simulation;
  }

  /**
   * Obtém preço médio atual das ofertas do produto na cidade
   */
  private async getAveragePrice(
    tenantId: string,
    cityId: string,
    productId: string
  ): Promise<number | null> {
    const rows = await runQueriesWithTenant<ProductOfferRow>(
      tenantId,
      {
        text: `
        SELECT price
        FROM product_offers
        WHERE tenant_id = $1
          AND product_id = $2
          AND location_city_id = $3
          AND active = TRUE
        `,
        values: [tenantId, productId, cityId],
      }
    );

    if (rows.length === 0) {
      return null;
    }

    const total = rows.reduce(
      (sum, row) => sum + parseFloat(row.price),
      0
    );
    return total / rows.length;
  }

  /**
   * Calcula preço dinâmico simulado
   * Baseado em demanda vs oferta
   */
  private calculateDynamicPrice(
    currentPrice: number,
    demandIndex: number,
    supplyIndex: number,
    demandSupplyRatio: number
  ): number {
    // Se demanda > oferta (ratio > 1), aumentar preço
    // Se oferta > demanda (ratio < 1), diminuir preço
    // Ajuste máximo: ±20% do preço atual

    let adjustmentFactor = 1.0;

    if (demandSupplyRatio > 1.0) {
      // Alta demanda: aumentar preço
      // Ratio 1.0 = 0%, Ratio 2.0 = 10%, Ratio 3.0+ = 20% (máximo)
      const excessDemand = Math.min(demandSupplyRatio - 1.0, 2.0); // Cap em 2.0
      adjustmentFactor = 1.0 + excessDemand * 0.1; // 10% por unidade de excesso
      adjustmentFactor = Math.min(adjustmentFactor, 1.2); // Máximo 20%
    } else if (demandSupplyRatio < 1.0 && demandSupplyRatio > 0) {
      // Alta oferta: diminuir preço
      // Ratio 0.5 = -10%, Ratio 0.0 = -20% (máximo)
      const excessSupply = 1.0 - demandSupplyRatio;
      adjustmentFactor = 1.0 - excessSupply * 0.2; // 20% por unidade de excesso
      adjustmentFactor = Math.max(adjustmentFactor, 0.8); // Mínimo -20%
    }
    // Se ratio = 1.0 ou 0, manter preço (adjustmentFactor = 1.0)

    return currentPrice * adjustmentFactor;
  }

  /**
   * Determina motivo do ajuste de preço
   */
  private getAdjustmentReason(
    demandSupplyRatio: number,
    priceChangePercent: number
  ): string {
    if (priceChangePercent > 5) {
      return `Alta demanda (ratio ${demandSupplyRatio.toFixed(2)}) - aumento de ${priceChangePercent.toFixed(1)}%`;
    } else if (priceChangePercent < -5) {
      return `Alta oferta (ratio ${demandSupplyRatio.toFixed(2)}) - redução de ${Math.abs(priceChangePercent).toFixed(1)}%`;
    } else if (priceChangePercent > 0) {
      return `Demanda moderadamente alta (ratio ${demandSupplyRatio.toFixed(2)}) - aumento de ${priceChangePercent.toFixed(1)}%`;
    } else if (priceChangePercent < 0) {
      return `Oferta moderadamente alta (ratio ${demandSupplyRatio.toFixed(2)}) - redução de ${Math.abs(priceChangePercent).toFixed(1)}%`;
    } else {
      return `Equilíbrio demanda/oferta (ratio ${demandSupplyRatio.toFixed(2)}) - sem ajuste`;
    }
  }

  /**
   * Log estruturado de simulação de preço por cidade
   */
  private async logPricingSimulation(
    tenantId: string,
    cityId: string,
    result: CityDynamicPricingResult
  ): Promise<void> {
    // Log estruturado no console
    console.log(
      JSON.stringify({
        module: 'dynamic-pricing',
        eventType: 'pricing_simulation',
        tenantId,
        cityId,
        totalProducts: result.totalProducts,
        productsWithPriceIncrease: result.productsWithPriceIncrease,
        productsWithPriceDecrease: result.productsWithPriceDecrease,
        totalPriceImpact: result.totalPriceImpact,
        computedAt: result.computedAt,
        timestamp: new Date().toISOString(),
      })
    );

    // Registrar no Decision Log (observação)
    try {
      await decisionLogService.createObservation(
        'economy',
        'dynamic_pricing_simulation',
        {
          cityId,
        },
        0,
        {
          metadata: {
            totalProducts: result.totalProducts,
            productsWithPriceIncrease: result.productsWithPriceIncrease,
            productsWithPriceDecrease: result.productsWithPriceDecrease,
            totalPriceImpact: result.totalPriceImpact,
            simulations: result.simulations.map((s) => ({
              productId: s.productId,
              currentPrice: s.currentPrice,
              simulatedPrice: s.simulatedPrice,
              priceChangePercent: s.priceChangePercent,
              demandSupplyRatio: s.demandSupplyRatio,
              adjustmentReason: s.adjustmentReason,
              // Blindagem semântica: qualidade da simulação
              simulationConfidence: s.simulationConfidence,
              isSimulation: true, // Marca explícita: nunca executar automaticamente
            })),
          },
        }
      );
    } catch (error) {
      // Não falhar silenciosamente - log o erro
      console.error(
        '[DynamicPricingService] Erro ao registrar no Decision Log:',
        error
      );
    }
  }

  /**
   * Log estruturado de preço por produto
   */
  private async logProductPricing(
    tenantId: string,
    cityId: string,
    productId: string,
    simulation: DynamicPricingSimulation
  ): Promise<void> {
    // Log estruturado no console
    console.log(
      JSON.stringify({
        module: 'dynamic-pricing',
        eventType: 'product_pricing_simulation',
        tenantId,
        cityId,
        productId,
        currentPrice: simulation.currentPrice,
        simulatedPrice: simulation.simulatedPrice,
        priceChange: simulation.priceChange,
        priceChangePercent: simulation.priceChangePercent,
        demandSupplyRatio: simulation.demandSupplyRatio,
        adjustmentReason: simulation.adjustmentReason,
        computedAt: simulation.computedAt,
        timestamp: new Date().toISOString(),
      })
    );

    // Registrar no Decision Log (observação)
    try {
      await decisionLogService.createObservation(
        'economy',
        'product_dynamic_pricing',
        {
          cityId,
        },
        simulation.currentPrice,
        {
          suggestedValue: simulation.simulatedPrice ?? undefined,
          metadata: {
            productId,
            priceChange: simulation.priceChange,
            priceChangePercent: simulation.priceChangePercent,
            demandIndex: simulation.demandIndex,
            supplyIndex: simulation.supplyIndex,
            demandSupplyRatio: simulation.demandSupplyRatio,
            adjustmentReason: simulation.adjustmentReason,
            // Blindagem semântica: qualidade da simulação
            simulationConfidence: simulation.simulationConfidence,
            isSimulation: true, // Marca explícita: nunca executar automaticamente
          },
        }
      );
    } catch (error) {
      // Não falhar silenciosamente - log o erro
      console.error(
        '[DynamicPricingService] Erro ao registrar no Decision Log:',
        error
      );
    }
  }
}

export const dynamicPricingService = new DynamicPricingService();

