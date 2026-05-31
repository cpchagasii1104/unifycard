// backend/src/core/profile/professional-c1/professional-c1.routes.ts
//
// C1 — rotas actor-first do perfil profissional (DESENHO_A2, Contrato A1).
// ActionContext OBRIGATÓRIO em TODAS as rotas. Leitura por actionContext.actorId já resolvido
// (sem ensureUserActor, sem criação). Guarda de identidade + invariante delegados ao service.
// Caminho NOVO /professional/c1 (não colide com o legado /professional). Legado intocado.

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { HttpError } from '@core/errors/http-error';
import { professionalC1Service } from './professional-c1.service';

// Precondição comum (ordem do desenho §3): actionContext → tenant.
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

const bioSchema = z.object({
  professional_bio: z.string().max(5000).nullable(),
});

const declareSchema = z.object({
  concept_id: z.string().uuid(),
  source_category_id: z.string().uuid().nullable().optional(),
  skill_level: z.number().int().min(1).max(5),
  years_experience: z.number().int().min(0).max(80).nullable().optional(),
});

export const patchSchema = z.object({
  skill_level: z.number().int().min(1).max(5).optional(),
  years_experience: z.number().int().min(0).max(80).nullable().optional(),
  reactivate: z.literal(true).optional(),
});

// Guarda de PATCH vazio: nenhum campo material veio (null em years É material — limpa anos).
export function isEmptyPatch(data: z.infer<typeof patchSchema>): boolean {
  return (
    data.skill_level === undefined &&
    data.years_experience === undefined &&
    data.reactivate === undefined
  );
}

export const conceptParamSchema = z.object({ conceptId: z.string().uuid() });

const professionalC1Routes: FastifyPluginAsync = async (fastify) => {
  // R1 — GET /profile/professional/c1
  fastify.get('/professional/c1', async (req, reply) => {
    try {
      const { tenantId, actorId } = requireContext(req);
      const result = await professionalC1Service.getProfessionalC1(tenantId, actorId);
      return reply.status(200).send(result);
    } catch (error) {
      return fail(reply, error);
    }
  });

  // R2 — PUT /profile/professional/c1/bio
  fastify.put('/professional/c1/bio', async (req, reply) => {
    try {
      const { tenantId, actorId } = requireContext(req);
      const parsed = bioSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Payload inválido', details: parsed.error.issues });
      }
      const result = await professionalC1Service.updateBio(tenantId, actorId, parsed.data.professional_bio);
      return reply.status(200).send(result);
    } catch (error) {
      return fail(reply, error);
    }
  });

  // R3 — POST /profile/professional/c1/concepts
  fastify.post('/professional/c1/concepts', async (req, reply) => {
    try {
      const { tenantId, actorId } = requireContext(req);
      const parsed = declareSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Payload inválido', details: parsed.error.issues });
      }
      const result = await professionalC1Service.declareConcept(tenantId, actorId, {
        conceptId: parsed.data.concept_id,
        sourceCategoryId: parsed.data.source_category_id ?? null,
        skillLevel: parsed.data.skill_level,
        yearsExperience: parsed.data.years_experience ?? null,
      });
      return reply.status(201).send(result);
    } catch (error) {
      return fail(reply, error);
    }
  });

  // R4 — PATCH /profile/professional/c1/concepts/:conceptId
  fastify.patch<{ Params: { conceptId: string } }>(
    '/professional/c1/concepts/:conceptId',
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
        // PATCH vazio: nenhum campo material → 400 (não toca updated_at sem alteração real).
        if (isEmptyPatch(parsed.data)) {
          return reply.status(400).send({ error: 'Nada a atualizar' });
        }
        const result = await professionalC1Service.updateConcept(tenantId, actorId, parsedParams.data.conceptId, {
          skillLevel: parsed.data.skill_level,
          yearsExperience: parsed.data.years_experience,
          reactivate: parsed.data.reactivate,
        });
        return reply.status(200).send(result);
      } catch (error) {
        return fail(reply, error);
      }
    }
  );

  // R5 — DELETE /profile/professional/c1/concepts/:conceptId (desativação lógica)
  fastify.delete<{ Params: { conceptId: string } }>(
    '/professional/c1/concepts/:conceptId',
    async (req, reply) => {
      try {
        const { tenantId, actorId } = requireContext(req);
        const parsedParams = conceptParamSchema.safeParse(req.params);
        if (!parsedParams.success) {
          return reply.status(400).send({ error: 'Parâmetro inválido', details: parsedParams.error.issues });
        }
        const result = await professionalC1Service.retireConcept(tenantId, actorId, parsedParams.data.conceptId);
        return reply.status(200).send(result);
      } catch (error) {
        return fail(reply, error);
      }
    }
  );
};

export default professionalC1Routes;
