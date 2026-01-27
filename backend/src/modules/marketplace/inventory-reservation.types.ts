// backend/src/modules/marketplace/inventory-reservation.types.ts
// SPRINT 43: ESTOQUE COM RESERVA (SOFT HOLD)
// Tipos TypeScript para reservas de estoque

export type InventoryReservationStatus = 'ACTIVE' | 'RELEASED' | 'CONSUMED';
export type InventoryReservationSource = 'MARKETPLACE' | 'PDV';

export interface InventoryReservation {
  id: string;
  tenantId: string;
  productVariantId: string;
  quantity: number;
  orderId: string;
  source: InventoryReservationSource;
  status: InventoryReservationStatus;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReserveStockInput {
  productVariantId: string;
  quantity: number;
  orderId: string;
  source: InventoryReservationSource;
  expiresAt?: Date; // Opcional, para reservas temporárias
}

export interface AvailableStock {
  productVariantId: string;
  totalBalance: number; // Saldo real (derivado de movements)
  reservedQuantity: number; // Quantidade reservada (ACTIVE)
  availableQuantity: number; // Disponível = totalBalance - reservedQuantity
}







