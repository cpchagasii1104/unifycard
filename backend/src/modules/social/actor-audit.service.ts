// src/modules/social/actor-audit.service.ts
// Serviço de auditoria para troca de Actor ativo
// 🔴 BLINDAGEM: Eventos de auditoria NÃO são feed, NÃO são visíveis ao usuário final
// Servem para auditoria, debugging e segurança

import { getClientWithTenant } from '@core/database/pool';
import {
  insertEventOutboxRow,
  outboxEventIdFromSeed,
} from '@core/events/event-outbox.repository';

/**
 * Registra evento de troca de Actor ativo
 * Evento interno (não social) para auditoria e segurança
 */
export async function recordActorSwitch(
  tenantId: string,
  userId: string,
  fromActorId: string | null,
  toActorId: string,
  context?: Record<string, unknown>
): Promise<void> {
  const ts = new Date().toISOString();
  const outboxClient = await getClientWithTenant(tenantId);
  try {
    await outboxClient.query('BEGIN');
    await insertEventOutboxRow(outboxClient, {
      tenantId,
      eventId: outboxEventIdFromSeed(
        `actor.switched:${tenantId}:${userId}:${fromActorId ?? 'null'}:${toActorId}:${ts}`
      ),
      eventType: 'actor.switched',
      eventVersion: 1,
      payload: {
        from_actor_id: fromActorId,
        to_actor_id: toActorId,
        user_id: userId,
        tenant_id: tenantId,
        context: context || {},
      },
      metadata: {
        timestamp: ts,
        source: 'actor-audit-service',
      },
    });
    await outboxClient.query('COMMIT');
  } catch (err) {
    await outboxClient.query('ROLLBACK');
    throw err;
  } finally {
    outboxClient.release();
  }
}

