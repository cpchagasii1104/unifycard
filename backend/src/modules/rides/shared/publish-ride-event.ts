/**
 * Publicação de eventos de domínio rides: outbox transacional (SSOT de entrega pós-commit).
 * @see docs/03_execution_log/RIDES_MOBILIDADE_EXECUTION_FINAL_2026-04-13.md — FASE 5
 */
import type { PoolClient } from 'pg';
import { insertEventOutboxRow, outboxEventIdFromSeed } from '@core/events/event-outbox.repository';

export type RideDomainBusEvent = {
  type: string;
  tenantId: string;
  payload: Record<string, unknown>;
};

function stableOutboxSeed(event: RideDomainBusEvent): string {
  const p = event.payload;
  const rideId = typeof p.rideId === 'string' ? p.rideId : '';
  const requestId = typeof p.requestId === 'string' ? p.requestId : '';
  return `${event.type}|${event.tenantId}|${rideId}|${requestId}|${JSON.stringify(p)}`;
}

/**
 * Insere linha em `event_outbox` na mesma transação que a mutação de estado.
 */
export async function publishRideEventOutbox(client: PoolClient, event: RideDomainBusEvent): Promise<void> {
  await insertEventOutboxRow(client, {
    tenantId: event.tenantId,
    eventId: outboxEventIdFromSeed(stableOutboxSeed(event)),
    eventType: event.type,
    payload: event.payload,
  });
}