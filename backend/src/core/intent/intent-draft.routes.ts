import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const draftItemSchema = z.object({
  concept_ref: z.string().uuid(),
  offer_ref: z.string().uuid().optional(),
  quantity: z.number().int().positive(),
  item: z
    .object({
      options: z.record(z.unknown()).optional(),
    })
    .optional(),
});

const intentDraftBodySchema = z.object({
  intent_type: z.string().trim().min(1).max(256),
  items: z.array(draftItemSchema).min(1),
});

const intentDraftRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Body: z.infer<typeof intentDraftBodySchema>;
  }>('/draft', async (req, reply) => {
    if (!req.tenant?.id) {
      return reply.status(400).send({
        ok: false,
        error: 'tenant obrigatório',
        code: 'TENANT_REQUIRED',
      });
    }

    const parsed = intentDraftBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: 'validação estrutural falhou',
        code: 'VALIDATION_FAILED',
        details: parsed.error.flatten(),
      });
    }

    return reply.send({
      ok: true,
      validation: 'passed',
    });
  });
};

export default intentDraftRoutes;