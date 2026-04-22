// src/modules/social/actor.utils.ts
// Utilitário canônico para resolução de Actor ativo em requisições

import { FastifyRequest } from 'fastify';
import { ensureUserActor } from '@modules/identity/actor-writer.service';
import { actorRepository, type ActorRow } from './actor.repository';
import { BadRequestError, ForbiddenError } from '@core/errors';
import { recordActorSwitch } from './actor-audit.service';

export interface ResolveActorOptions {
  /**
   * Se true, permite fallback para actor PF quando actorId não fornecido
   * Se false, retorna erro 400 quando actorId ausente
   * Padrão: false (não permite fallback silencioso)
   */
  allowUserFallback?: boolean;
  /**
   * userId para fallback (apenas se allowUserFallback = true)
   */
  userId?: string;
}

/**
 * Resolve Actor ativo a partir de uma requisição Fastify
 * 
 * Prioridade de resolução:
 * 1. Header "x-actor-id" (e opcionalmente "x-actor-type")
 * 2. Querystring "actor_id" e "actor_type"
 * 3. Se nada foi enviado:
 *    - Se allowUserFallback = true: usa ensureUserActor (writer canónico §4.8)
 *    - Se allowUserFallback = false: retorna erro 400
 * 
 * @param req Requisição Fastify
 * @param tenantId ID do tenant
 * @param options Opções de resolução
 * @returns Actor ativo
 * @throws BadRequestError se actor não encontrado ou não fornecido
 */
export async function resolveActiveActorFromRequest(
  req: FastifyRequest,
  tenantId: string,
  options: ResolveActorOptions = {}
): Promise<ActorRow> {
  const { allowUserFallback = false, userId } = options;

  // Prioridade 1: Header "x-actor-id" ou "x-acting-actor-id" (compatibilidade)
  const headerActorId = req.headers['x-actor-id'] || req.headers['x-acting-actor-id'];
  const headerActorType = req.headers['x-actor-type'];

  if (headerActorId && typeof headerActorId === 'string') {
    const actor = await actorRepository.findById(tenantId, headerActorId);
    if (!actor) {
      throw new BadRequestError(`Actor não encontrado: ${headerActorId}`);
    }
    return actor;
  }

  // Prioridade 2: Querystring "actor_id" e "actor_type"
  const query = req.query as any;
  const queryActorId = query.actor_id;
  const queryActorType = query.actor_type;

  if (queryActorId && queryActorType) {
    const actor = await actorRepository.findById(tenantId, queryActorId);
    if (!actor) {
      throw new BadRequestError(`Actor não encontrado: ${queryActorId}`);
    }
    return actor;
  }

  // Prioridade 3: Fallback ou erro
  if (allowUserFallback && userId) {
    // Fallback para compatibilidade (apenas quando explicitamente permitido)
    return await ensureUserActor(tenantId, userId);
  }

  // Erro explícito quando actor não fornecido
  throw new BadRequestError(
    'Missing active actor. Provide x-actor-id header or actor_id query parameter.'
  );
}

