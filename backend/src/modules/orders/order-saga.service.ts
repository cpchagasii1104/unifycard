import type { OrderSagaRow } from './order-saga.repository';
import { getByOrderId, upsertState } from './order-saga.repository';

export async function getState(
  tenantId: string,
  orderId: string
): Promise<OrderSagaRow | undefined> {
  return getByOrderId(tenantId, orderId);
}

/**
 * Atualiza status da saga (legado). Preferir `orderSagaService` em `@core/sagas/order-saga.service`.
 */
export async function setState(
  tenantId: string,
  orderId: string,
  status: string,
  metadata: Record<string, unknown> = {}
): Promise<OrderSagaRow> {
  return upsertState(tenantId, orderId, status, metadata);
}