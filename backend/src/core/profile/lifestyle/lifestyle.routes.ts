// backend/src/core/profile/lifestyle/lifestyle.routes.ts
//
// F3 (DECISION-0071) — rotas actor-first do SSOT Lifestyle. ActionContext OBRIGATÓRIO
// (actorId = req.actionContext.actorId, NUNCA req.user.id). visibility NUNCA é parâmetro (sempre private).
// Body camelCase; consent explícito obrigatório no PUT. key via z.enum → `sexual_orientation` ⇒ 400.

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { HttpError } from '@core/errors/http-error';
import { lifestyleService } from './lifestyle.service';

function requireContext(req: FastifyRequest): { tenantId: string; actorId: string } {
  if (!req.actionContext?.actorId) {
    throw HttpError.badRequest('ActionContext obrigatório');
  }
  if (!req.tenant?.id) {
    throw HttpError.badRequest('Tenant não encontrado');
  }
  return { tenantId: req.tenant.id, actorId: req.actionContext.actorId };
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
      const { tenantId, actorId } = requireContext(req);
      const result = await lifestyleService.getLifestyle(tenantId, actorId);
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
        const { tenantId, actorId } = requireContext(req);
        const parsedKey = keyParamSchema.safeParse(req.params);
        if (!parsedKey.success) {
          return reply.status(400).send({ error: 'attributeKey inválido', details: parsedKey.error.issues });
        }
        const parsedBody = declareBodySchema.safeParse(req.body);
        if (!parsedBody.success) {
          return reply.status(400).send({ error: 'Payload inválido', details: parsedBody.error.issues });
        }
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
          actorId
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
        const { tenantId, actorId } = requireContext(req);
        const parsedKey = keyParamSchema.safeParse(req.params);
        if (!parsedKey.success) {
          return reply.status(400).send({ error: 'attributeKey inválido', details: parsedKey.error.issues });
        }
        const result = await lifestyleService.retireAttribute(tenantId, actorId, parsedKey.data.attributeKey, actorId);
        return reply.status(200).send(result);
      } catch (error) {
        return fail(reply, error);
      }
    }
  );
};

export default lifestyleRoutes;
