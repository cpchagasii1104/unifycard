// backend/src/modules/marketplace/inventory-suggestion.service.ts
// SPRINT 59: SUGESTÃO DE REPOSIÇÃO DE ESTOQUE (ASSISTIDA, READ-ONLY)

import { inventorySlaService } from './inventory-sla.service';
import { inventoryService } from './inventory.service';
import { inventoryReservationService } from './inventory-reservation.service';
import { productVariantRepository } from './product-variant.repository';
import type {
  InventorySuggestion,
  InventorySuggestionType,
  ConfidenceLevel,
  SuggestionReasonCode,
  GetInventorySuggestionsOptions,
  SuggestionConfig,
} from './inventory-suggestion.types';

/**
 * Service para sugestões de reposição de estoque
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - READ-ONLY: Nenhuma mutação de estado
 * - NÃO cria estoque
 * - NÃO cria transferências
 * - NÃO cria ajustes
 * - NÃO cria alertas automáticos
 * - NÃO persiste sugestões
 * - Apenas recomendações para decisão humana
 */
class InventorySuggestionService {
  /**
   * Gera sugestões de reposição/ajuste de estoque
   * 
   * SPRINT 59: Calcula sugestões baseadas em regras explícitas
   */
  async getSuggestions(
    tenantId: string,
    options: GetInventorySuggestionsOptions = {},
    config: SuggestionConfig = {}
  ): Promise<InventorySuggestion[]> {
    const suggestions: InventorySuggestion[] = [];

    // Configurações padrão
    const minDaysOfStock = config.minDaysOfStock || 7;
    const highAgingThreshold = config.highAgingThreshold || 30;
    const excessStockMultiplier = config.excessStockMultiplier || 2.0;
    const stockoutRiskThreshold = config.stockoutRiskThreshold || 3;
    const staleStockThreshold = config.staleStockThreshold || 60;
    const lowTurnoverThreshold = config.lowTurnoverThreshold || 0.1;

    // TODO: Buscar variantes ativas e calcular sugestões
    // Por enquanto, vamos implementar a lógica de sugestão para uma variante específica
    // ou todas as variantes se não especificado

    // 1. REPLENISH: Estoque baixo
    if (!options.suggestionType || options.suggestionType === 'REPLENISH') {
      const replenishSuggestions = await this.generateReplenishSuggestions(
        tenantId,
        options,
        { minDaysOfStock, highAgingThreshold }
      );
      suggestions.push(...replenishSuggestions);
    }

    // 2. TRANSFER: Transferência entre filiais
    if (!options.suggestionType || options.suggestionType === 'TRANSFER') {
      const transferSuggestions = await this.generateTransferSuggestions(
        tenantId,
        options,
        { excessStockMultiplier, stockoutRiskThreshold }
      );
      suggestions.push(...transferSuggestions);
    }

    // 3. REDUCE: Redução de estoque parado
    if (!options.suggestionType || options.suggestionType === 'REDUCE') {
      const reduceSuggestions = await this.generateReduceSuggestions(
        tenantId,
        options,
        { staleStockThreshold, lowTurnoverThreshold }
      );
      suggestions.push(...reduceSuggestions);
    }

    // Filtrar por confiança mínima
    if (options.minConfidence) {
      const confidenceOrder: ConfidenceLevel[] = ['LOW', 'MEDIUM', 'HIGH'];
      const minConfidenceIndex = confidenceOrder.indexOf(options.minConfidence);
      return suggestions.filter((s) => {
        const suggestionConfidenceIndex = confidenceOrder.indexOf(s.confidenceLevel);
        return suggestionConfidenceIndex >= minConfidenceIndex;
      });
    }

    // Ordenar por confiança (HIGH primeiro) e limitar
    const sorted = suggestions.sort((a, b) => {
      const order: ConfidenceLevel[] = ['LOW', 'MEDIUM', 'HIGH'];
      return order.indexOf(b.confidenceLevel) - order.indexOf(a.confidenceLevel);
    });

    const limit = options.limit || 50;
    const offset = options.offset || 0;
    return sorted.slice(offset, offset + limit);
  }

  /**
   * Gera sugestões de REPLENISH (reposição)
   */
  private async generateReplenishSuggestions(
    tenantId: string,
    options: GetInventorySuggestionsOptions,
    config: { minDaysOfStock: number; highAgingThreshold: number }
  ): Promise<InventorySuggestion[]> {
    const suggestions: InventorySuggestion[] = [];

    // TODO: Buscar variantes com estoque baixo
    // Por enquanto, retornar array vazio
    // A implementação completa precisaria:
    // 1. Buscar aging de estoque
    // 2. Calcular média de vendas (via sales reports)
    // 3. Identificar variantes com estoque < minDaysOfStock

    return suggestions;
  }

  /**
   * Gera sugestões de TRANSFER (transferência entre filiais)
   */
  private async generateTransferSuggestions(
    tenantId: string,
    options: GetInventorySuggestionsOptions,
    config: { excessStockMultiplier: number; stockoutRiskThreshold: number }
  ): Promise<InventorySuggestion[]> {
    const suggestions: InventorySuggestion[] = [];

    // TODO: Buscar oportunidades de transferência
    // Por enquanto, retornar array vazio
    // A implementação completa precisaria:
    // 1. Buscar aging por filial
    // 2. Identificar filiais com excesso (estoque > média * excessStockMultiplier)
    // 3. Identificar filiais com risco de ruptura (estoque < stockoutRiskThreshold dias)
    // 4. Sugerir transferência entre filiais da mesma organização

    return suggestions;
  }

  /**
   * Gera sugestões de REDUCE (redução de estoque parado)
   */
  private async generateReduceSuggestions(
    tenantId: string,
    options: GetInventorySuggestionsOptions,
    config: { staleStockThreshold: number; lowTurnoverThreshold: number }
  ): Promise<InventorySuggestion[]> {
    const suggestions: InventorySuggestion[] = [];

    // Buscar aging de estoque
    const aging = await inventorySlaService.getStockAging(tenantId, {
      productVariantId: options.productVariantId,
      minDaysInStock: config.staleStockThreshold,
      limit: 100,
    });

    for (const item of aging) {
      // Calcular rotatividade (simplificado: baseado em aging)
      // TODO: Calcular rotatividade real baseada em vendas
      const turnoverRate = item.daysInStock > 0 ? 1 / item.daysInStock : 0;

      if (turnoverRate < config.lowTurnoverThreshold) {
        const suggestedQuantity = -Math.floor(item.currentQuantity * 0.3); // Sugerir reduzir 30%

        suggestions.push({
          productVariantId: item.productVariantId,
          actorId: item.actorId || '', // TODO: Adicionar actor_id quando disponível
          suggestionType: 'REDUCE',
          suggestedQuantity,
          reasonCodes: ['HIGH_AGING_LOW_TURNOVER', 'STALE_STOCK'],
          confidenceLevel: item.daysInStock > config.staleStockThreshold * 2 ? 'HIGH' : 'MEDIUM',
          explanation: `Estoque parado há ${item.daysInStock} dias com baixa rotatividade (${(turnoverRate * 100).toFixed(1)}%). Sugestão: reduzir ${Math.abs(suggestedQuantity)} unidades.`,
          metadata: {
            currentStock: item.currentQuantity,
            agingDays: item.daysInStock,
            turnoverRate,
          },
        });
      }
    }

    return suggestions;
  }

  /**
   * Explica uma sugestão em detalhes
   * 
   * SPRINT 59: Fornece explicação clara e legível
   */
  explainSuggestion(suggestion: InventorySuggestion): string {
    const parts: string[] = [];

    parts.push(`Sugestão: ${suggestion.suggestionType}`);
    parts.push(`Variante: ${suggestion.productVariantId}`);
    parts.push(`Filial: ${suggestion.actorId || 'N/A'}`);
    parts.push(`Quantidade sugerida: ${suggestion.suggestedQuantity > 0 ? '+' : ''}${suggestion.suggestedQuantity}`);
    parts.push(`Confiança: ${suggestion.confidenceLevel}`);
    parts.push('');
    parts.push('Motivos:');
    for (const reasonCode of suggestion.reasonCodes) {
      parts.push(`- ${this.getReasonDescription(reasonCode)}`);
    }
    parts.push('');
    parts.push(`Explicação: ${suggestion.explanation}`);

    if (Object.keys(suggestion.metadata).length > 0) {
      parts.push('');
      parts.push('Dados de apoio:');
      for (const [key, value] of Object.entries(suggestion.metadata)) {
        if (value !== undefined && value !== null) {
          parts.push(`- ${key}: ${value}`);
        }
      }
    }

    return parts.join('\n');
  }

  /**
   * Retorna descrição legível de um código de motivo
   */
  private getReasonDescription(reasonCode: SuggestionReasonCode): string {
    const descriptions: Record<SuggestionReasonCode, string> = {
      LOW_STOCK_DAYS: 'Estoque disponível abaixo do mínimo recomendado (em dias de venda)',
      HIGH_AGING_ACTIVE: 'Estoque com aging alto mas com saída recorrente',
      EXCESS_STOCK: 'Filial com excesso de estoque em relação à média',
      STOCKOUT_RISK: 'Filial com risco de ruptura de estoque',
      HIGH_AGING_LOW_TURNOVER: 'Estoque com aging alto e baixa rotatividade',
      STALE_STOCK: 'Estoque parado acima do threshold configurado',
      CROSS_BRANCH_OPPORTUNITY: 'Oportunidade de transferência entre filiais',
    };
    return descriptions[reasonCode] || reasonCode;
  }
}

export const inventorySuggestionService = new InventorySuggestionService();







