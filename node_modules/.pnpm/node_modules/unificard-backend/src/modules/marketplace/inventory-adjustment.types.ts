// backend/src/modules/marketplace/inventory-adjustment.types.ts
// SPRINT 57: Tipos para ajustes de estoque

export type InventoryAdjustmentType = 'LOSS' | 'DAMAGE' | 'SURPLUS';
export type InventoryAdjustmentReferenceType = 'RECEIPT' | 'MANUAL';

export interface InventoryAdjustment {
  id: string;
  tenantId: string;
  actorId: string;
  productVariantId: string;
  inventoryLotId?: string | null;
  adjustmentType: InventoryAdjustmentType;
  quantity: number; // Signed: negativo para LOSS/DAMAGE, positivo para SURPLUS
  reason: string;
  referenceType?: InventoryAdjustmentReferenceType | null;
  referenceId?: string | null;
  createdByUserId: string;
  metadata?: Record<string, any> | null;
  createdAt: Date;
}

export interface CreateInventoryAdjustmentInput {
  actorId: string;
  productVariantId: string;
  inventoryLotId?: string;
  adjustmentType: InventoryAdjustmentType;
  quantity: number; // Signed: negativo para LOSS/DAMAGE, positivo para SURPLUS
  reason: string;
  referenceType?: InventoryAdjustmentReferenceType;
  referenceId?: string;
  metadata?: Record<string, any>;
}

export interface ListInventoryAdjustmentsOptions {
  actorId?: string;
  productVariantId?: string;
  adjustmentType?: InventoryAdjustmentType;
  referenceType?: InventoryAdjustmentReferenceType;
  referenceId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}







