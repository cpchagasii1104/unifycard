// backend/src/core/profile/learning-c1/learning-c1.routes.ts
//
// C1 — rotas actor-first de APRENDIZADO (DECISION-0067). ActionContext OBRIGATÓRIO.
// actorId = req.actionContext.actorId (NUNCA req.user.id). Caminho NOVO /learning/c1 (não colide com
// o legado /learning). Legado intocado. Body camelCase; interno snake.

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { HttpError } from '@core/errors/http-error';
import { learningC1Service } from './learning-c1.service';

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

const declareSchema = z.object({
  conceptId: z.string().uuid(),
  sourceCategoryId: z.string().uuid().nullable().optional(),
  progress: z.number().int().min(1).max(3).nullable().optional(),
});

export const patchSchema = z.object({
  progress: z.number().int().min(1).max(3).nullable().optional(),
  sourceCategoryId: z.string().uuid().nullable().optional(),
  reactivate: z.literal(true).optional(),
});

export function isEmptyPatch(data: z.infer<typeof patchSchema>): boolean {
  return (
    data.progress === undefined &&
    data.sourceCategoryId === undefined &&
    data.reactivate === undefined
  );
}

export const conceptParamSchema = z.object({ conceptId: z.string().uuid() });

const learningC1Routes: FastifyPluginAsync = async (fastify) => {
  // R1 — GET /profile/learning/c1
  fastify.get('/learning/c1', async (req, reply) => {
    try {
      const { tenantId, actorId } = requireContext(req);
      const result = await learningC1Service.getLearningC1(tenantId, actorId);
      return reply.status(200).send(result);
    } catch (error) {
      return fail(reply, error);
    }
  });

  // R2 — POST /profile/learning/c1/concepts
  fastify.post('/learning/c1/concepts', async (req, reply) => {
    try {
      const { tenantId, actorId } = requireContext(req);
      const parsed = declareSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Payload inválido', details: parsed.error.issues });
      }
      const result = await learningC1Service.declareConcept(tenantId, actorId, {
        conceptId: parsed.data.conceptId,
        sourceCategoryId: parsed.data.sourceCategoryId ?? null,
        progress: parsed.data.progress ?? null,
      });
      return reply.status(201).send(result);
    } catch (error) {
      return fail(reply, error);
    }
  });

  // R3 — PATCH /profile/learning/c1/concepts/:conceptId
  fastify.patch<{ Params: { conceptId: string } }>(
    '/learning/c1/concepts/:conceptId',
    async (req, reply) => {
      try {
        const { tenantId, actorId } = requireContext(req);
        const parsedParams = conceptParamSchema.safeParse(req.params);
        if (!parsedParams.success) {
          return reply.status(400).send({ error: 'Parâmetro inválido', details: parsedParams.error.issues });
        }
        const parsed = patchSchema.safeParse(req.body);
        if (!parsed.success) {
          return reply.status(400).send({ error: 'Payload inválido', details: parsed.error.issues });
        }
        if (isEmptyPatch(parsed.data)) {
          return reply.status(400).send({ error: 'Nada a atualizar' });
        }
        const result = await learningC1Service.updateConcept(tenantId, actorId, parsedParams.data.conceptId, {
          progress: parsed.data.progress,
          sourceCategoryId: parsed.data.sourceCategoryId,
          reactivate: parsed.data.reactivate,
        });
        return reply.status(200).send(result);
      } catch (error) {
        return fail(reply, error);
      }
    }
  );

  // R4 — DELETE /profile/learning/c1/concepts/:conceptId (desativação lógica)
  fastify.delete<{ Params: { conceptId: string } }>(
    '/learning/c1/concepts/:conceptId',
    async (req, reply) => {
      try {
        const { tenantId, actorId } = requireContext(req);
        const parsedParams = conceptParamSchema.safeParse(req.params);
        if (!parsedParams.success) {
          return reply.status(400).send({ error: 'Parâmetro inválido', details: parsedParams.error.issues });
        }
        const result = await learningC1Service.retireConcept(tenantId, actorId, parsedParams.data.conceptId);
        return reply.status(200).send(result);
      } catch (error) {
        return fail(reply, error);
      }
    }
  );
};

export default learningC1Routes;
