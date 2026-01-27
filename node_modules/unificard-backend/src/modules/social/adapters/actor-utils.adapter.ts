// src/modules/social/adapters/actor-utils.adapter.ts
/**
 * Adapter: Actor Utils
 * 
 * Implementa interface do core usando utils real do module.
 */

import type { ActorUtilsPort } from '@core/social/ports';
import { resolveActiveActorFromRequest as realResolveActiveActorFromRequest } from '../actor.utils';
import type { FastifyRequest } from 'fastify';

export class ActorUtilsAdapter implements ActorUtilsPort {
  async resolveActiveActorFromRequest(
    req: FastifyRequest,
    tenantId: string,
    options?: { allowUserFallback?: boolean; userId?: string }
  ) {
    return realResolveActiveActorFromRequest(req, tenantId, options);
  }
}

export const actorUtilsAdapter = new ActorUtilsAdapter();





