// backend/src/modules/marketplace/inventory-suggestion.types.ts
// SPRINT 59: Tipos para sugestões de reposição de estoque (read-only, assistido)

export type InventorySuggestionType = 'REPLENISH' | 'TRANSFER' | 'REDUCE';
export type ConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * Código de motivo da sugestão
 */
export type SuggestionReasonCode =
  | 'LOW_STOCK_DAYS' // Estoque disponível < X dias de venda média
  | 'HIGH_AGING_ACTIVE' // Aging alto + saída recorrente
  | 'EXCESS_STOCK' // Filial com excesso de estoque
  | 'STOCKOUT_RISK' // Filial com risco de ruptura
  | 'HIGH_AGING_LOW_TURNOVER' // Aging alto + baixa rotatividade
  | 'STALE_STOCK' // Estoque parado acima de threshold
  | 'CROSS_BRANCH_OPPORTUNITY'; // Oportunidade de transferência entre filiais

/**
 * Sugestão de reposição/ajuste de estoque
 * 
 * ⚠️ READ-ONLY: Não é persistida, apenas calculada
 */
export interface InventorySuggestion {
  productVariantId: string;
  actorId: string;
  suggestionType: InventorySuggestionType;
  suggestedQuantity: number; // Quantidade sugerida (pode ser negativa para REDUCE)
  reasonCodes: SuggestionReasonCode[];
  confidenceLevel: ConfidenceLevel;
  explanation: string; // Explicação legível para humanos
  metadata: {
    currentStock?: number;
    averageDailySales?: number;
    daysOfStock?: number;
    agingDays?: number;
    targetActorId?: string; // Para TRANSFER
    sourceActorId?: string; // Para TRANSFER
    turnoverRate?: number;
    [key: string]: any;
  };
}

/**
 * Opções para buscar sugestões
 */
export interface GetInventorySuggestionsOptions {
  actorId?: string;
  productVariantId?: string;
  suggestionType?: InventorySuggestionType;
  minConfidence?: ConfidenceLevel;
  limit?: number;
  offset?: number;
}

/**
 * Configuração de thresholds para sugestões
 */
export interface SuggestionConfig {
  // REPLENISH
  minDaysOfStock?: number; // Estoque mínimo em dias (padrão: 7)
  highAgingThreshold?: number; // Dias de aging para considerar alto (padrão: 30)
  
  // TRANSFER
  excessStockMultiplier?: number; // Multiplicador para considerar excesso (padrão: 2.0)
  stockoutRiskThreshold?: number; // Dias de estoque para considerar risco (padrão: 3)
  
  // REDUCE
  staleStockThreshold?: number; // Dias de aging para considerar parado (padrão: 60)
  lowTurnoverThreshold?: number; // Rotatividade mínima (padrão: 0.1)
}







