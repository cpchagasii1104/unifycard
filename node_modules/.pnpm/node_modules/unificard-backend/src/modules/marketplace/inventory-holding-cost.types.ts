// backend/src/modules/marketplace/inventory-holding-cost.types.ts
// SPRINT 60: Tipos para custo de estoque parado (read-only)

export type CostLevel = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * Custo de estoque parado (holding cost)
 * 
 * ⚠️ READ-ONLY: Não é persistido, apenas calculado
 */
export interface InventoryHoldingCost {
  productVariantId: string;
  actorId: string;
  quantity: number;
  unitCost: number; // Preço base (último preço válido)
  daysInStock: number; // Dias desde último movimento IN
  dailyHoldingRate: number; // Taxa diária de holding (ex: 0.001 = 0.1% ao dia)
  totalHoldingCost: number; // Custo total = quantity * unitCost * daysInStock * dailyHoldingRate
  costLevel: CostLevel; // Nível de custo (LOW, MEDIUM, HIGH)
  explanation: string; // Explicação legível
  metadata: {
    lastMovementAt?: Date | null;
    priceValidFrom?: Date | null;
    priceValidTo?: Date | null;
    [key: string]: any;
  };
}

/**
 * Opções para buscar custos de estoque parado
 */
export interface GetHoldingCostsOptions {
  actorId?: string;
  productVariantId?: string;
  minDays?: number; // Filtrar apenas itens com X dias ou mais
  minCost?: number; // Filtrar apenas itens com custo >= X
  minCostLevel?: CostLevel; // Filtrar por nível mínimo de custo
  limit?: number;
  offset?: number;
}

/**
 * Configuração de cálculo de holding cost
 */
export interface HoldingCostConfig {
  dailyHoldingRate?: number; // Taxa diária (padrão: 0.001 = 0.1% ao dia)
  lowCostThreshold?: number; // Threshold para LOW (padrão: 100)
  mediumCostThreshold?: number; // Threshold para MEDIUM (padrão: 500)
  highCostThreshold?: number; // Threshold para HIGH (padrão: 1000)
}







