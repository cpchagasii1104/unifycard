// backend/src/modules/marketplace/inventory-sla.types.ts
// SPRINT 58: Tipos para SLA logístico e aging de estoque (read-only)

/**
 * Aging de estoque (tempo que itens ficam parados)
 */
export interface StockAging {
  productVariantId: string;
  actorId: string;
  currentQuantity: number;
  unit: string;
  daysInStock: number; // Dias desde último movimento IN
  lastMovementAt: Date | null;
  lastMovementType: 'IN' | 'OUT' | 'ADJUSTMENT' | null;
}

/**
 * Opções para buscar aging de estoque
 */
export interface GetStockAgingOptions {
  actorId?: string;
  productVariantId?: string;
  minDaysInStock?: number; // Filtrar apenas itens com X dias ou mais
  maxDaysInStock?: number; // Filtrar apenas itens com X dias ou menos
  limit?: number;
  offset?: number;
}

/**
 * SLA de transferência (tempo entre estados)
 */
export interface TransferSla {
  stockTransferId: string;
  fromActorId: string;
  toActorId: string;
  status: 'DRAFT' | 'PENDING' | 'SHIPPED' | 'RECEIVED' | 'CANCELLED';
  
  // Tempos (em dias)
  daysInDraft: number | null; // Tempo em DRAFT
  daysShippedToReceiving: number | null; // SHIPPED → início da conferência (receipt)
  daysReceivingToReceived: number | null; // Início conferência → RECEIVED
  totalDays: number | null; // Tempo total (SHIPPED → RECEIVED)
  
  // Datas
  createdAt: string;
  shippedAt: Date | null;
  receivingStartedAt: Date | null; // Primeiro receipt (created_at)
  receivedAt: Date | null;
  
  // Flags de atraso (configuráveis)
  isOverdue: boolean; // Se excedeu SLA configurado
  overdueReason?: string; // Motivo do atraso
}

/**
 * Opções para buscar SLA de transferências
 */
export interface GetTransferSlaOptions {
  fromActorId?: string;
  toActorId?: string;
  status?: 'DRAFT' | 'PENDING' | 'SHIPPED' | 'RECEIVED' | 'CANCELLED';
  onlyOverdue?: boolean; // Apenas transferências atrasadas
  maxDaysShippedToReceiving?: number; // SLA SHIPPED → início conferência
  maxDaysReceivingToReceived?: number; // SLA conferência → RECEIVED
  limit?: number;
  offset?: number;
}

/**
 * Configuração de SLA (valores padrão)
 */
export interface SlaConfig {
  maxDaysShippedToReceiving?: number; // SLA padrão: SHIPPED → conferência (ex: 3 dias)
  maxDaysReceivingToReceived?: number; // SLA padrão: conferência → RECEIVED (ex: 1 dia)
}








