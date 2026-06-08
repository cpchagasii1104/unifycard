// backend/src/core/profile/lifestyle/lifestyle.routes.ts
//
// F3 (DECISION-0071) — rotas actor-first do SSOT Lifestyle. ActionContext OBRIGATÓRIO
// (actorId = req.actionContext.actorId, NUNCA req.user.id). visibility NUNCA é parâmetro (sempre private).
// Body camelCase; consent explícito obrigatório no PUT. key via z.enum → `sexual_orientation` ⇒ 400.

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { HttpError } from '@core/errors/http-error';
import { lifestyleService } from './lifestyle.service';

// 🔴 DECISION-0113 fatia 5.3 (LGPD): extrai também o `userId` do `req.user` (principal autenticado) para
// threadar ao service (gate `canRepresentActor`). Sem `req.user` → 401.
function requireContext(req: FastifyRequest): { tenantId: string; actorId: string; userId: string } {
  if (!req.actionContext?.actorId) {
    throw HttpError.badRequest('ActionContext obrigatório');
  }
  if (!req.tenant?.id) {
    throw HttpError.badRequest('Tenant não encontrado');
  }
  const userId = req.user?.userId;
  if (!userId) {
    throw new HttpError('Autenticação obrigatória', 401);
  }
  return { tenantId: req.tenant.id, actorId: req.actionContext.actorId, userId };
}

// 🔴 DECISION-0113 fatia 5.3 (LGPD): a AUTORIA da trilha de consentimento (`performedByActorId`) é derivada
// server-side do actor REAL do `req.user`, NUNCA do `actionContext.actorId` cru. Se o caller autenticado não
// tem user-actor resolvível, NÃO há performer real → sem performer, sem mutação/consentimento/audit (403
// fail-closed; jamais cai no subject como fallback de autoria). Resolução na borda (mantém o service sem lookup solto).
async function resolvePerformerActorId(req: FastifyRequest): Promise<string> {
  const userId = req.user?.userId;
  if (!userId || !req.tenant?.id) {
    throw new HttpError('Autenticação obrigatória', 401);
  }
  const { socialPortsRegistry } = await import('@core/social/ports-registry');
  const callerActor = await socialPortsRegistry.getActorRepository().findByUserId(req.tenant.id, userId);
  if (!callerActor) {
    throw new HttpError('Performer não resolvível (actor do usuário autenticado não encontrado)', 403);
  }
  return callerActor.actor_id;
}

function fail(reply: FastifyReply, error: unknown): FastifyReply {
  const err = error as Error & { statusCode?: number };
  return reply.status(err.statusCode ?? 500).send({ error: err.message });
}

const keyParamSchema = z.object({
  attributeKey: z.enum(['relationship_status', 'drinks', 'smokes']),
});

const declareBodySchema = z.object({
  attributeValue: z.string().min(1),
  consent: z.object({
    accepted: z.literal(true), // consentimento explícito obrigatório (sem consent fake)
    source: z.string().optional(),
    version: z.string().optional(),
  }),
});

const lifestyleRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /profile/lifestyle — atributos ativos (self).
  fastify.get('/lifestyle', async (req, reply) => {
    try {
      const { tenantId, actorId, userId } = requireContext(req);
      const result = await lifestyleService.getLifestyle(tenantId, actorId, userId);
      return reply.status(200).send(result);
    } catch (error) {
      return fail(reply, error);
    }
  });

  // PUT /profile/lifestyle/attributes/:attributeKey — declara/atualiza (consent obrigatório).
  fastify.put<{ Params: { attributeKey: string } }>(
    '/lifestyle/attributes/:attributeKey',
    async (req, reply) => {
      try {
        const { tenantId, actorId, userId } = requireContext(req);
        const parsedKey = keyParamSchema.safeParse(req.params);
        if (!parsedKey.success) {
          return reply.status(400).send({ error: 'attributeKey inválido', details: parsedKey.error.issues });
        }
        const parsedBody = declareBodySchema.safeParse(req.body);
        if (!parsedBody.success) {
          return reply.status(400).send({ error: 'Payload inválido', details: parsedBody.error.issues });
        }
        const performedByActorId = await resolvePerformerActorId(req);
        const result = await lifestyleService.declareAttribute(
          tenantId,
          actorId,
          {
            attributeKey: parsedKey.data.attributeKey,
            attributeValue: parsedBody.data.attributeValue,
            consent: {
              granted: parsedBody.data.consent.accepted,
              source: parsedBody.data.consent.source ?? null,
              version: parsedBody.data.consent.version ?? null,
            },
          },
          userId,
          performedByActorId
        );
        return reply.status(200).send(result);
      } catch (error) {
        return fail(reply, error);
      }
    }
  );

  // DELETE /profile/lifestyle/attributes/:attributeKey — retira/anonimiza.
  fastify.delete<{ Params: { attributeKey: string } }>(
    '/lifestyle/attributes/:attributeKey',
    async (req, reply) => {
      try {
        const { tenantId, actorId, userId } = requireContext(req);
        const parsedKey = keyParamSchema.safeParse(req.params);
        if (!parsedKey.success) {
          return reply.status(400).send({ error: 'attributeKey inválido', details: parsedKey.error.issues });
        }
        const performedByActorId = await resolvePerformerActorId(req);
        const result = await lifestyleService.retireAttribute(
          tenantId,
          actorId,
          parsedKey.data.attributeKey,
          userId,
          performedByActorId
        );
        return reply.status(200).send(result);
      } catch (error) {
        return fail(reply, error);
      }
    }
  );
};

export default lifestyleRoutes;
