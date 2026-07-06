// company-templates.routes.ts
// DECISION-0117 E — superfícies de templates empresariais (prefixo /companies).
// Aplicação manual-assistida («Aplicar» explícito); leitura membership-scoped via
// canManageCompany (gestão) para aplicar/personalizar. Menu/projeção consome
// effectiveModules. Zero efeito comercial; zero Bank.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { businessTemplatesService, BusinessTemplateError } from './business-templates.service';

const applySchema = z.object({
  templateId: z.string().uuid(),
  templateVersionId: z.string().uuid().optional().nullable(),
});

const customizeSchema = z.object({
  customizations: z.record(z.unknown()),
});

const companyTemplatesRoutes: FastifyPluginAsync = async (fastify) => {
  function subject(req: { user?: { userId?: string; globalUserId?: string } }): { userId: string; globalUserId: string } | null {
    const userId = req.user?.userId;
    const globalUserId = req.user?.globalUserId;
    if (!userId || !globalUserId) return null;
    return { userId, globalUserId };
  }

  /** Catálogo de templates ativos (recomendação é sugestão; nunca auto-aplica). */
  fastify.get('/templates/catalog', async (_req, reply) => {
    const data = await businessTemplatesService.listActiveTemplates();
    return reply.send({ ok: true, data });
  });

  fastify.get<{ Params: { companyId: string } }>(
    '/:companyId/templates/recommended',
    async (req, reply) => {
      const data = await businessTemplatesService.recommendForCompany(req.tenant!.id, req.params.companyId);
      return reply.send({ ok: true, data });
    }
  );

  fastify.post<{ Params: { companyId: string } }>(
    '/:companyId/templates/apply',
    async (req, reply) => {
      const sub = subject(req as never);
      if (!sub) return reply.status(401).send({ ok: false, code: 'UNAUTHENTICATED' });
      const parsed = applySchema.safeParse(req.body);
      if (!parsed.success) return reply.status(400).send({ ok: false, code: 'TEMPLATE_APPLY_BAD_REQUEST', issues: parsed.error.issues });
      try {
        const data = await businessTemplatesService.applyTemplate({
          tenantId: req.tenant!.id,
          userId: sub.userId,
          globalUserId: sub.globalUserId,
          companyId: req.params.companyId,
          templateId: parsed.data.templateId as string,
          templateVersionId: (parsed.data.templateVersionId as string | undefined) ?? null,
        });
        return reply.status(data.alreadyApplied ? 200 : 201).send({ ok: true, data });
      } catch (err) {
        if (err instanceof BusinessTemplateError) return reply.status(err.statusCode).send({ ok: false, code: err.code, message: err.message });
        throw err;
      }
    }
  );

  fastify.patch<{ Params: { companyId: string; applicationId: string } }>(
    '/:companyId/templates/applications/:applicationId/customize',
    async (req, reply) => {
      const sub = subject(req as never);
      if (!sub) return reply.status(401).send({ ok: false, code: 'UNAUTHENTICATED' });
      const parsed = customizeSchema.safeParse(req.body);
      if (!parsed.success) return reply.status(400).send({ ok: false, code: 'TEMPLATE_CUSTOMIZE_BAD_REQUEST', issues: parsed.error.issues });
      try {
        await businessTemplatesService.customizeApplication({
          tenantId: req.tenant!.id,
          userId: sub.userId,
          globalUserId: sub.globalUserId,
          companyId: req.params.companyId,
          applicationId: req.params.applicationId,
          customizations: (parsed.data.customizations as Record<string, unknown>) ?? {},
        });
        return reply.send({ ok: true });
      } catch (err) {
        if (err instanceof BusinessTemplateError) return reply.status(err.statusCode).send({ ok: false, code: err.code, message: err.message });
        throw err;
      }
    }
  );

  fastify.get<{ Params: { companyId: string } }>(
    '/:companyId/templates/applications',
    async (req, reply) => {
      const data = await businessTemplatesService.listApplications(req.tenant!.id, req.params.companyId);
      return reply.send({ ok: true, data });
    }
  );

  fastify.get<{ Params: { companyId: string } }>(
    '/:companyId/templates/effective-modules',
    async (req, reply) => {
      const data = await businessTemplatesService.effectiveModulesForCompany(req.tenant!.id, req.params.companyId);
      return reply.send({ ok: true, data });
    }
  );
};

export default companyTemplatesRoutes;
