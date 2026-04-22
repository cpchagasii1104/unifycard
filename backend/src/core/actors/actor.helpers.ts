/**
 * Helpers para resolver actor a partir de tenant + user.
 * Criação/garantia via writer canónico ensureUserActor (§4.8).
 */

import type { ActorTypeDb } from '@core/social/actor-type';
import { ensureUserActor } from '@modules/identity/actor-writer.service';

export interface ActiveActor {
  actor_id: string;
  tenant_id: string;
  actor_type: ActorTypeDb;
  user_id: string | null;
  display_name: string;
}

/**
 * Retorna o actor ativo (user) para o par tenantId + userId.
 * Usado por rotas que precisam de actor_id para RBAC.
 */
export async function getActiveActor(
  tenantId: string,
  userId: string
): Promise<ActiveActor | null> {
  const actor = await ensureUserActor(tenantId, userId);
  if (!actor) return null;
  return {
    actor_id: actor.actor_id,
    tenant_id: actor.tenant_id,
    actor_type: actor.actor_type,
    user_id: actor.user_id,
    display_name: actor.display_name,
  };
}