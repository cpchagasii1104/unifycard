// src/core/social/ports/actor-utils.port.ts
/**
 * Port: Actor Utils
 * 
 * Interface para utilitários de actor.
 * Implementação real está em @modules/social
 */

import type { FastifyRequest } from 'fastify';
import type { ActorRow } from './actor-repository.port';

export interface ResolveActorOptions {
  allowUserFallback?: boolean;
  userId?: string;
}

export interface ActorUtilsPort {
  resolveActiveActorFromRequest(
    req: FastifyRequest,
    tenantId: string,
    options?: ResolveActorOptions
  ): Promise<ActorRow>;
}





