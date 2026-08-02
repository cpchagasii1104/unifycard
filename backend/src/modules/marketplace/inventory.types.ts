// backend/src/modules/marketplace/inventory.types.ts
// SPRINT 37.3: MARKETPLACE CORE - Estoque (Movimentação)
// Tipos para movimentações e saldos de estoque

/**
 * Tipo de movimentação de estoque
 */
export type InventoryMovementType = 'in' | 'out' | 'adjustment'; // §4.78 (2026-08-02): movimento físico em lowercase, espelho da regra do financeiro

/**
 * Movimentação de estoque
 * Evento append-only que representa entrada/saída/ajuste
 */
export interface InventoryMovement {
  id: string;
  tenantId: string;
  /** Unidade operacional (actor elegível). */
  actorId: string;
  productVariantId: string;
  movementType: InventoryMovementType;
  quantity: number;
  unit: string;
  reason?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  inventoryLotId?: string | null; // SPRINT 37.4: Lote opcional
  metadata?: Record<string, any> | null;
  createdByUserId?: string | null;
  createdAt: string;
}

/**
 * Input para criar movimentação
 */
export interface CreateInventoryMovementInput {
  /** Obrigatório: local de stock (actor elegível no tenant). */
  actorId: string;
  productVariantId: string;
  movementType: InventoryMovementType;
  quantity: number;
  unit?: string;
  reason?: string;
  referenceType?: string;
  referenceId?: string;
  inventoryLotId?: string | null; // SPRINT 37.4: Lote opcional
  metadata?: Record<string, any>;
  createdByUserId?: string;
}

/**
 * Opções de busca de movimentações
 */
export interface ListInventoryMovementsOptions {
  movementType?: InventoryMovementType;
  actorId?: string;
  referenceType?: string;
  referenceId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Saldo de estoque (derivado)
 * ⚠️ READ MODEL OPCIONAL: Fonte da verdade = inventory_movements
 */
export interface InventoryBalance {
  productVariantId: string;
  tenantId: string;
  currentQuantity: number;
  unit: string;
  updatedAt: string;
}

/**
 * Lote de produto (opt-in)
 * Permite rastreabilidade por lote e validade
 */
export interface InventoryLot {
  id: string;
  tenantId: string;
  productVariantId: string;
  lotCode: string;
  manufactureDate?: Date | null;
  expirationDate?: Date | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

/**
 * Input para criar lote
 */
export interface CreateInventoryLotInput {
  productVariantId: string;
  lotCode: string;
  manufactureDate?: Date | null;
  expirationDate?: Date | null;
  metadata?: Record<string, any>;
}


