// backend/src/core/audience/audience.routes.ts
// Endpoint TRANSVERSAL de opções de plateia (Clayton 2026-07-07: "fonte única para TODAS as opções").
// Consumido por posts, demanda, evento, locação e qualquer módulo que publique oferta/conteúdo.
// A verdade é derivada de PAIR_ALLOWED_LABELS (buildAudienceOptions) — nunca hardcoded no cliente.
//
// Muda por ACTOR (actor_type → labels válidos). NÃO muda por modo operante: a plateia é projeção das
// RELAÇÕES do actor (identity/authority), não da operação (consumir/operar). O modo operante decide
// QUE ATO você publica, não QUEM pode ver — separação de camadas (CONTEXT ≠ relação tipada).

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError } from '@core/errors';
import { buildAudienceOptions } from './audience-options';

const audienceRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /audience-options — opções de plateia para o actor representado (actionContext.actorId).
  fastify.get('/audience-options', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.tenant) return reply.status(400).send({ ok: false, code: 'TENANT_REQUIRED' });
    const actorId = req.actionContext?.actorId;
    if (!actorId) return reply.status(400).send({ ok: false, code: 'ACTION_CONTEXT_REQUIRED' });
    const userId = req.user?.userId;
    if (!userId) return reply.status(401).send({ ok: false, code: 'AUTH_REQUIRED' });

    // Autoridade server-side: só projeta plateia do actor que o usuário REALMENTE representa.
    const { authorizationService } = await import('@core/authorization/authorization.service');
    let represents = false;
    try {
      represents = await authorizationService.canRepresentActor(req.tenant.id, userId, actorId);
    } catch {
      represents = false;
    }
    if (!represents) throw new ForbiddenError('Usuário não representa o actor declarado (canRepresentActor)');

    const { socialPortsRegistry } = await import('@core/social/ports-registry');
    const actor = await socialPortsRegistry.getActorRepository().findById(req.tenant.id, actorId) as { actor_type: string } | null;
    if (!actor) return reply.status(404).send({ ok: false, code: 'ACTOR_NOT_FOUND' });

    const options = buildAudienceOptions(actor.actor_type);
    return reply.send({ ok: true, data: { actorType: actor.actor_type, options } });
  });
};

export default audienceRoutes;
