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
  status: 'DRAFT' | 'SHIPPED' | 'RECEIVING' | 'RECEIVED' | 'CANCELLED';
  
  // Tempos (em dias)
  daysInDraft: number | null; // Tempo em DRAFT
  daysShippedToReceiving: number | null; // Tempo entre SHIPPED → RECEIVING
  daysReceivingToReceived: number | null; // Tempo entre RECEIVING → RECEIVED
  totalDays: number | null; // Tempo total (SHIPPED → RECEIVED)
  
  // Datas
  createdAt: Date;
  shippedAt: Date | null;
  receivingStartedAt: Date | null; // Quando status mudou para RECEIVING
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
  status?: 'DRAFT' | 'SHIPPED' | 'RECEIVING' | 'RECEIVED' | 'CANCELLED';
  onlyOverdue?: boolean; // Apenas transferências atrasadas
  maxDaysShippedToReceiving?: number; // SLA máximo para SHIPPED → RECEIVING
  maxDaysReceivingToReceived?: number; // SLA máximo para RECEIVING → RECEIVED
  limit?: number;
  offset?: number;
}

/**
 * Configuração de SLA (valores padrão)
 */
export interface SlaConfig {
  maxDaysShippedToReceiving?: number; // SLA padrão: SHIPPED → RECEIVING (ex: 3 dias)
  maxDaysReceivingToReceived?: number; // SLA padrão: RECEIVING → RECEIVED (ex: 1 dia)
}







