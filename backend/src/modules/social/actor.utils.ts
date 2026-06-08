// src/modules/social/actor.utils.ts
// Utilitário canônico para resolução de Actor ativo em requisições

import { FastifyRequest } from 'fastify';
import { ensureUserActor } from '@modules/identity/actor-writer.service';
import { actorRepository, type ActorRow } from './actor.repository';
import { BadRequestError, ForbiddenError, UnauthorizedError } from '@core/errors';
import { recordActorSwitch } from './actor-audit.service';

/**
 * 🔴 DECISION-0113 (vetor x-actor-id, sub-campanha 2026-06-08): `x-actor-id`/`x-acting-actor-id` (header) e
 * `actor_id` (query) são HINTS declarados pelo cliente, NÃO autoridade — exatamente como o `actionContext.actorId`.
 * Se o caller declara um actor por header/query, o resolver só pode retorná-lo se o **usuário autenticado**
 * (`req.user`) puder REPRESENTÁ-LO (`canRepresentActor`). Sem `req.user` → 401. Não representável (inclui
 * inexistente, pois `canRepresentActor` é uniforme) → 403 não-leak. O fallback self (prioridade 3) deriva de
 * `req.user` (não do header) e não precisa deste gate.
 */
async function assertActorRepresentable(req: FastifyRequest, tenantId: string, declaredActorId: string): Promise<void> {
  const callerUserId = (req as { user?: { userId?: string } }).user?.userId;
  if (!callerUserId) {
    throw new UnauthorizedError('Autenticação obrigatória para resolver o actor declarado');
  }
  let canRepresent = false;
  try {
    const { authorizationService } = await import('@core/authorization/authorization.service');
    canRepresent = await authorizationService.canRepresentActor(tenantId, callerUserId, declaredActorId);
  } catch {
    canRepresent = false;
  }
  if (!canRepresent) {
    throw new ForbiddenError('Actor declarado não representável pelo usuário autenticado');
  }
}

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
    // 🔴 DECISION-0113 (x-actor-id): header é hint — exige representabilidade do req.user antes de retornar.
    await assertActorRepresentable(req, tenantId, headerActorId);
    const actor = await actorRepository.findById(tenantId, headerActorId);
    if (!actor) {
      // não-leak: inacessível (cobre inexistente; canRepresentActor já teria negado actor de outrem).
      throw new ForbiddenError('Actor não acessível');
    }
    return actor;
  }

  // Prioridade 2: Querystring "actor_id" e "actor_type"
  const query = req.query as any;
  const queryActorId = query.actor_id;
  const queryActorType = query.actor_type;

  if (queryActorId && queryActorType) {
    // 🔴 DECISION-0113 (actor_id query): mesmo gate de representabilidade do header.
    await assertActorRepresentable(req, tenantId, queryActorId);
    const actor = await actorRepository.findById(tenantId, queryActorId);
    if (!actor) {
      throw new ForbiddenError('Actor não acessível');
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

