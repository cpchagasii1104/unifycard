// backend/src/modules/marketplace/inventory-holding-cost.service.ts
// SPRINT 60: CUSTO DE ESTOQUE PARADO (READ-ONLY)

import { inventorySlaService } from './inventory-sla.service';
import { pricingService } from './pricing.service';
import type {
  InventoryHoldingCost,
  CostLevel,
  GetHoldingCostsOptions,
  HoldingCostConfig,
} from './inventory-holding-cost.types';

/**
 * Service para cálculo de custo de estoque parado
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - READ-ONLY: Nenhuma mutação de estado
 * - NÃO sugere ação
 * - NÃO cria alerta
 * - NÃO ajusta estoque
 * - NÃO persiste custo
 * - Apenas exposição analítica
 */
class InventoryHoldingCostService {
  /**
   * Calcula custos de estoque parado
   * 
   * SPRINT 60: Calcula custo baseado em aging, preço e taxa de holding
   */
  async getHoldingCosts(
    tenantId: string,
    options: GetHoldingCostsOptions = {},
    config: HoldingCostConfig = {}
  ): Promise<InventoryHoldingCost[]> {
    // Configurações padrão
    const dailyHoldingRate = config.dailyHoldingRate || 0.001; // 0.1% ao dia
    const lowCostThreshold = config.lowCostThreshold || 100;
    const mediumCostThreshold = config.mediumCostThreshold || 500;
    const highCostThreshold = config.highCostThreshold || 1000;

    // 1. Buscar aging de estoque
    const aging = await inventorySlaService.getStockAging(tenantId, {
      productVariantId: options.productVariantId,
      minDaysInStock: options.minDays || 0,
      limit: options.limit || 100,
      offset: options.offset || 0,
    });

    const holdingCosts: InventoryHoldingCost[] = [];

    // 2. Para cada item com aging, calcular custo
    for (const item of aging) {
      // Buscar preço atual da variante
      let unitCost = 0;
      let priceValidFrom: Date | null = null;
      let priceValidTo: Date | null = null;

      try {
        const price = await pricingService.getCurrentPrice(tenantId, {
          variantId: item.productVariantId,
        });

        if (price && price.finalPrice > 0) {
          unitCost = price.finalPrice;
          // TODO: Adicionar validFrom/validTo quando disponível no pricing service
        }
      } catch (error) {
        // Se não houver preço, usar 0 (custo será 0)
        console.warn(`[HoldingCost] Preço não encontrado para variante ${item.productVariantId}:`, error);
      }

      // 3. Calcular custo total
      const totalHoldingCost = item.currentQuantity * unitCost * item.daysInStock * dailyHoldingRate;

      // 4. Filtrar por custo mínimo se especificado
      if (options.minCost !== undefined && totalHoldingCost < options.minCost) {
        continue;
      }

      // 5. Determinar nível de custo
      let costLevel: CostLevel = 'LOW';
      if (totalHoldingCost >= highCostThreshold) {
        costLevel = 'HIGH';
      } else if (totalHoldingCost >= mediumCostThreshold) {
        costLevel = 'MEDIUM';
      }

      // Filtrar por nível mínimo se especificado
      if (options.minCostLevel) {
        const levelOrder: CostLevel[] = ['LOW', 'MEDIUM', 'HIGH'];
        const minLevelIndex = levelOrder.indexOf(options.minCostLevel);
        const currentLevelIndex = levelOrder.indexOf(costLevel);
        if (currentLevelIndex < minLevelIndex) {
          continue;
        }
      }

      // 6. Gerar explicação
      const explanation = this.generateExplanation(
        item.currentQuantity,
        unitCost,
        item.daysInStock,
        dailyHoldingRate,
        totalHoldingCost,
        costLevel
      );

      holdingCosts.push({
        productVariantId: item.productVariantId,
        actorId: item.actorId || '',
        quantity: item.currentQuantity,
        unitCost,
        daysInStock: item.daysInStock,
        dailyHoldingRate,
        totalHoldingCost,
        costLevel,
        explanation,
        metadata: {
          lastMovementAt: item.lastMovementAt,
          priceValidFrom,
          priceValidTo,
        },
      });
    }

    // 7. Ordenar por custo total (maior primeiro)
    return holdingCosts.sort((a, b) => b.totalHoldingCost - a.totalHoldingCost);
  }

  /**
   * Gera explicação legível do custo
   */
  private generateExplanation(
    quantity: number,
    unitCost: number,
    daysInStock: number,
    dailyHoldingRate: number,
    totalHoldingCost: number,
    costLevel: CostLevel
  ): string {
    const parts: string[] = [];

    parts.push(`Estoque parado: ${quantity} unidades`);
    parts.push(`Preço unitário: R$ ${unitCost.toFixed(2)}`);
    parts.push(`Dias parado: ${daysInStock} dias`);
    parts.push(`Taxa diária: ${(dailyHoldingRate * 100).toFixed(2)}%`);
    parts.push(`Custo total acumulado: R$ ${totalHoldingCost.toFixed(2)}`);
    parts.push(`Nível de custo: ${costLevel}`);

    if (unitCost === 0) {
      parts.push('(Atenção: Preço não encontrado, custo calculado como R$ 0,00)');
    }

    return parts.join(' | ');
  }

  /**
   * Calcula custo total agregado por filial
   */
  async getTotalHoldingCostByActor(
    tenantId: string,
    actorId: string,
    config: HoldingCostConfig = {}
  ): Promise<{ actorId: string; totalCost: number; itemCount: number }> {
    const costs = await this.getHoldingCosts(tenantId, { actorId }, config);
    const totalCost = costs.reduce((sum, cost) => sum + cost.totalHoldingCost, 0);

    return {
      actorId,
      totalCost,
      itemCount: costs.length,
    };
  }

  /**
   * Calcula custo total agregado geral
   */
  async getTotalHoldingCost(
    tenantId: string,
    options: GetHoldingCostsOptions = {},
    config: HoldingCostConfig = {}
  ): Promise<{ totalCost: number; itemCount: number; averageCost: number }> {
    const costs = await this.getHoldingCosts(tenantId, options, config);
    const totalCost = costs.reduce((sum, cost) => sum + cost.totalHoldingCost, 0);
    const averageCost = costs.length > 0 ? totalCost / costs.length : 0;

    return {
      totalCost,
      itemCount: costs.length,
      averageCost,
    };
  }
}

export const inventoryHoldingCostService = new InventoryHoldingCostService();

