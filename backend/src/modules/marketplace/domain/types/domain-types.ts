// backend/src/modules/marketplace/domain/types/domain-types.ts
// Tipos estritos do domínio — campos críticos obrigatórios.
// Contratos externos permanecem permissivos; uso interno em domain/** e application/services/**.

import type { Order, ServiceRequest, ServiceOrder, CheckoutIntent } from '@contracts/marketplace';

/**
 * Order no domínio: createdAt, tenantId e status sempre definidos.
 */
export interface OrderDomain extends Omit<Order, 'createdAt'> {
  orderId: string;
  tenantId: string;
  createdAt: string;
  status: string;
}

/**
 * ServiceRequest no domínio: createdAt e status sempre definidos; tenantId opcional (request não tem tenant no contrato).
 */
export interface ServiceRequestDomain extends ServiceRequest {
  requestId: string;
  createdAt: string;
  status: ServiceRequest['status'];
}

/**
 * ServiceOrder no domínio: requestId e status sempre definidos (contrato tem opcionais).
 */
export interface ServiceOrderDomain extends Omit<ServiceOrder, 'requestId' | 'status'> {
  requestId: string;
  status: string;
}

/**
 * CheckoutIntent no domínio: createdAt e paidAt com fallback; status sempre definido.
 */
export interface CheckoutIntentDomain extends Omit<CheckoutIntent, 'createdAt' | 'paidAt'> {
  checkoutId: string;
  status: CheckoutIntent['status'];
  createdAt: string;
  paidAt: string;
}