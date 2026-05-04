// backend/src/modules/marketplace/domain/types/mappers.ts
// Mappers: contrato → tipo de domínio (garantem campos críticos).

import type { Order, ServiceRequest, ServiceOrder, CheckoutIntent } from '@contracts/marketplace';
import type { OrderDomain, ServiceRequestDomain, ServiceOrderDomain, CheckoutIntentDomain } from './domain-types';

export function toOrderDomain(contract: Order, options: { tenantId: string; status?: string }): OrderDomain {
  return {
    ...contract,
    orderId: contract.orderId,
    tenantId: options.tenantId,
    createdAt: contract.createdAt ?? new Date().toISOString(),
    status: options.status ?? 'active',
  };
}

export function toServiceRequestDomain(contract: ServiceRequest): ServiceRequestDomain {
  return {
    ...contract,
    requestId: contract.requestId,
    createdAt: contract.createdAt,
    status: contract.status,
  };
}

export function toServiceOrderDomain(
  contract: ServiceOrder,
  options: { requestId?: string; status?: string }
): ServiceOrderDomain {
  return {
    ...contract,
    orderId: contract.orderId,
    bookingId: contract.bookingId,
    createdAt: contract.createdAt,
    requestId: options.requestId ?? contract.requestId ?? '',
    status: options.status ?? contract.status ?? 'pending',
  };
}

export function toCheckoutIntentDomain(contract: CheckoutIntent): CheckoutIntentDomain {
  return {
    ...contract,
    checkoutId: contract.checkoutId,
    status: contract.status,
    createdAt: contract.createdAt ?? new Date().toISOString(),
    paidAt: contract.paidAt ?? '',
  };
}