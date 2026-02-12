// src/modules/social/actor-audit.service.ts
// Serviço de auditoria para troca de Actor ativo
// 🔴 BLINDAGEM: Eventos de auditoria NÃO são feed, NÃO são visíveis ao usuário final
// Servem para auditoria, debugging e segurança

import { eventBus } from '@core/events/event-bus';

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
  await eventBus.publish({
    tenantId,
    type: 'actor.switched',
    version: 1,
    payload: {
      from_actor_id: fromActorId,
      to_actor_id: toActorId,
      user_id: userId,
      tenant_id: tenantId,
      context: context || {},
    },
    metadata: {
      timestamp: new Date().toISOString(),
      source: 'actor-audit-service',
    },
  });
}

