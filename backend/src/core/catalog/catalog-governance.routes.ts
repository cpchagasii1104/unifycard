// catalog-governance.routes.ts
// DECISION-0117 A/B/D/G/H — superfícies de SUGESTÃO empresarial e CURADORIA
// humana do catálogo canônico (prefixo /catalog/governance).
//
// Autoridade: sugestão = usuário autenticado + actor humano por LEITURA +
// canManageCompany (fail-closed; sem cura de actor). Curadoria = papel admin
// explícito (requireRole(['admin'])) — sem system actor improvisado.
// Zero Bank writer; zero preço/estoque em entidade canônica.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { socialPortsRegistry } from '../social/ports-registry';
import { catalogSuggestionService, CatalogSuggestionError } from './suggestions/catalog-suggestion.service';
import { catalogCurationService, CatalogCurationError } from './curation/catalog-curation.service';
import { canonicalServiceService, CanonicalServiceError } from './canonical/canonical-service.service';
import { canonicalVariantService, CanonicalVariantError } from './canonical/canonical-variant.service';
import { canonicalUnitsService, CanonicalUnitError } from './canonical/canonical-units.service';
import { authorizationService } from '@core/authorization/authorization.service';

const variantSchema = z.object({
  variantName: z.string().min(1),
  gtin: z.string().regex(/^[0-9]{8,14}$/).optional().nullable(),
  netContentValue: z.number().positive().optional().nullable(),
  netContentUnit: z.string().min(1).optional().nullable(),
  packageType: z.string().min(1).optional().nullable(),
  isReturnable: z.boolean().optional().nullable(),
  discriminatorAttributes: z.record(z.unknown()).optional().nullable(),
});

const suggestProductSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1),
  brand: z.string().optional().nullable(),
  gtin: z.string().regex(/^[0-9]{8,14}$/).optional().nullable(),
  categoryId: z.string().uuid(),
  variant: variantSchema.optional().nullable(),
});

const localProductSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  categoryId: z.string().uuid(),
  attributes: z.record(z.unknown()).optional().nullable(),
});

const suggestServiceSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1),
  conceptId: z.string().uuid(),
  description: z.string().optional().nullable(),
  baseDurationMinutes: z.number().int().positive().optional().nullable(),
});

const approveProductSchema = z.object({
  conceptId: z.string().uuid(),
  promoteToGlobal: z.boolean().optional(),
});

const mergeSchema = z.object({
  duplicateId: z.string().uuid(),
  winnerId: z.string().uuid(),
});

type KnownError =
  | CatalogSuggestionError
  | CatalogCurationError
  | CanonicalServiceError
  | CanonicalVariantError
  | CanonicalUnitError;

function isKnownError(err: unknown): err is KnownError {
  return (
    err instanceof CatalogSuggestionError ||
    err instanceof CatalogCurationError ||
    err instanceof CanonicalServiceError ||
    err instanceof CanonicalVariantError ||
    err instanceof CanonicalUnitError
  );
}

const catalogGovernanceRoutes: FastifyPluginAsync = async (fastify) => {
  /** Sujeito auth-derived (DECISION-0113: nunca do body). */
  function subject(req: { user?: { userId?: string; globalUserId?: string } }): { userId: string; globalUserId: string } | null {
    const userId = req.user?.userId;
    const globalUserId = req.user?.globalUserId;
    if (!userId || !globalUserId) return null;
    return { userId, globalUserId };
  }

  /** Actor humano do CURADOR por LEITURA — fail-closed (sem cura). */
  async function curatorActorId(tenantId: string, userId: string): Promise<string | null> {
    const actor = await socialPortsRegistry.getActorRepository().findByUserId(tenantId, userId);
    return actor?.actor_id ?? null;
  }

  // ── SUGESTÃO EMPRESARIAL ────────────────────────────────────────────────────
  fastify.post('/products/suggestions', async (req, reply) => {
    const sub = subject(req as never);
    if (!sub) return reply.status(401).send({ ok: false, code: 'UNAUTHENTICATED' });
    const parsed = suggestProductSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, code: 'CATALOG_SUGGEST_BAD_REQUEST', issues: parsed.error.issues });
    }
    try {
      // Cast pós-validação: zod já garantiu o shape em runtime (tsconfig strict:false degrada a inferência).
      const body = parsed.data as z.infer<typeof suggestProductSchema> & { companyId: string; name: string; categoryId: string };
      const data = await catalogSuggestionService.suggestIndustrialProduct({
        tenantId: req.tenant!.id,
        userId: sub.userId,
        globalUserId: sub.globalUserId,
        companyId: body.companyId,
        name: body.name,
        brand: body.brand ?? null,
        gtin: body.gtin ?? null,
        categoryId: body.categoryId,
        variant: (body.variant as never) ?? null,
      });
      return reply.status(data.created ? 201 : 200).send({ ok: true, data });
    } catch (err) {
      if (isKnownError(err)) return reply.status(err.statusCode).send({ ok: false, code: err.code, message: err.message });
      throw err;
    }
  });

  fastify.post('/products/local', async (req, reply) => {
    const sub = subject(req as never);
    if (!sub) return reply.status(401).send({ ok: false, code: 'UNAUTHENTICATED' });
    const parsed = localProductSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, code: 'CATALOG_LOCAL_BAD_REQUEST', issues: parsed.error.issues });
    }
    try {
      const body = parsed.data as z.infer<typeof localProductSchema> & { companyId: string; name: string; categoryId: string };
      const data = await catalogSuggestionService.createLocalProduct({
        tenantId: req.tenant!.id,
        userId: sub.userId,
        globalUserId: sub.globalUserId,
        companyId: body.companyId,
        name: body.name,
        description: body.description ?? null,
        categoryId: body.categoryId,
        attributes: (body.attributes as Record<string, unknown> | null) ?? null,
      });
      return reply.status(data.created ? 201 : 200).send({ ok: true, data });
    } catch (err) {
      if (isKnownError(err)) return reply.status(err.statusCode).send({ ok: false, code: err.code, message: err.message });
      throw err;
    }
  });

  fastify.post('/services/suggestions', async (req, reply) => {
    const sub = subject(req as never);
    if (!sub) return reply.status(401).send({ ok: false, code: 'UNAUTHENTICATED' });
    const parsed = suggestServiceSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, code: 'CATALOG_SERVICE_SUGGEST_BAD_REQUEST', issues: parsed.error.issues });
    }
    try {
      // Mesma régua de autoridade da sugestão de produto (actor por LEITURA + canManageCompany).
      const { companiesService } = await import('../companies/companies.service');
      const actor = await socialPortsRegistry.getActorRepository().findByUserId(req.tenant!.id, sub.userId);
      if (!actor?.actor_id) {
        return reply.status(403).send({ ok: false, code: 'CATALOG_SUGGEST_ACTOR_MISSING' });
      }
      const canManage = await companiesService.canManageCompany(req.tenant!.id, parsed.data.companyId, sub.globalUserId);
      if (!canManage) {
        return reply.status(403).send({ ok: false, code: 'CATALOG_SUGGEST_FORBIDDEN' });
      }
      const data = await canonicalServiceService.suggest({
        tenantId: req.tenant!.id,
        name: parsed.data.name,
        conceptId: parsed.data.conceptId,
        description: parsed.data.description ?? null,
        baseDurationMinutes: parsed.data.baseDurationMinutes ?? null,
        createdByActorId: actor.actor_id,
      });
      return reply.status(data.created ? 201 : 200).send({ ok: true, data });
    } catch (err) {
      if (isKnownError(err)) return reply.status(err.statusCode).send({ ok: false, code: err.code, message: err.message });
      throw err;
    }
  });

  // ── LEITURAS DE APOIO ───────────────────────────────────────────────────────
  fastify.get('/units', async (_req, reply) => {
    const units = await canonicalUnitsService.listUnits();
    return reply.send({ ok: true, data: units });
  });

  fastify.get<{ Params: { canonicalProductId: string } }>(
    '/products/:canonicalProductId/variants',
    async (req, reply) => {
      const variants = await canonicalVariantService.listByProduct(req.params.canonicalProductId);
      return reply.send({ ok: true, data: variants });
    }
  );

  fastify.get<{ Querystring: { q?: string } }>('/services/search', async (req, reply) => {
    const data = await canonicalServiceService.searchVisible(req.tenant!.id, req.query.q);
    return reply.send({ ok: true, data });
  });

  // F-MVP-SERVICE-PUBLISH-OFFERABLE-AUTOCOMPLETE (Opção A — ESTRITO): catálogo canônico filtrado ao que o
  // ACTOR ATIVO PODE PUBLICAR AGORA (concept declarado/publicado ATIVO). Fecha o beco de UX da publicação:
  // a tela só oferece o que o gate DECISION-0144 aceita.
  // 🔴 DECISION-0113: actor ATIVO = actionContext.actorId (HINT cliente-declarado), validado server-side por
  // canRepresentActor — NUNCA confia em actor_id livre como autoridade. A elegibilidade (PF/PJ) é resolvida no
  // backend (mesmo predicado do gate); o frontend só projeta a lista.
  fastify.get<{ Querystring: { q?: string } }>('/services/offerable', async (req, reply) => {
    const sub = subject(req as never);
    if (!sub) return reply.status(401).send({ ok: false, code: 'UNAUTHENTICATED' });
    const hintActorId = req.actionContext?.actorId;
    if (!hintActorId) return reply.status(400).send({ ok: false, code: 'OFFERABLE_ACTION_CONTEXT_REQUIRED' });
    const canRep = await authorizationService.canRepresentActor(req.tenant!.id, sub.userId, hintActorId);
    if (!canRep) return reply.status(403).send({ ok: false, code: 'OFFERABLE_ACTOR_NOT_REPRESENTABLE' });
    const actor = await socialPortsRegistry.getActorRepository().findById(req.tenant!.id, hintActorId);
    if (!actor) return reply.status(403).send({ ok: false, code: 'OFFERABLE_ACTOR_NOT_ACCESSIBLE' });
    const data = await canonicalServiceService.searchOfferable(req.tenant!.id, actor, req.query.q);
    return reply.send({ ok: true, data });
  });

  // ── CURADORIA (admin humano explícito) ──────────────────────────────────────
  fastify.get('/curation/queue', { preHandler: [fastify.requireRole(['admin'])] }, async (_req, reply) => {
    const data = await catalogCurationService.listPending();
    return reply.send({ ok: true, data });
  });

  fastify.post<{ Params: { canonicalProductId: string } }>(
    '/curation/products/:canonicalProductId/approve',
    { preHandler: [fastify.requireRole(['admin'])] },
    async (req, reply) => {
      const sub = subject(req as never);
      if (!sub) return reply.status(401).send({ ok: false, code: 'UNAUTHENTICATED' });
      const parsed = approveProductSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ ok: false, code: 'CURATION_BAD_REQUEST', issues: parsed.error.issues });
      }
      const curator = await curatorActorId(req.tenant!.id, sub.userId);
      if (!curator) return reply.status(403).send({ ok: false, code: 'CURATOR_ACTOR_MISSING' });
      // D1 FIX (F-SERVICE-CURATION-HARDENING-BEFORE-UI): promover scoped→GLOBAL muda o catálogo de TODOS
      // os tenants — autoridade de PLATAFORMA, não de tenant-admin (requireRole é tenant-scoped). Gate
      // env-strict fail-closed (padrão firewall): PLATFORM_CURATION_ADMIN_GLOBAL_USER_IDS = lista de
      // global_user_ids; ausente/vazia = NINGUÉM promove (403 honesto). Approve SCOPED segue tenant-admin.
      if (parsed.data.promoteToGlobal === true) {
        const allow = (process.env.PLATFORM_CURATION_ADMIN_GLOBAL_USER_IDS ?? '')
          .split(',').map((s) => s.trim()).filter(Boolean);
        if (!sub.globalUserId || !allow.includes(sub.globalUserId)) {
          return reply.status(403).send({ ok: false, code: 'PROMOTE_TO_GLOBAL_PLATFORM_GATE', message: 'Promoção a escopo global exige operador de plataforma (gate fail-closed).' });
        }
      }
      try {
        const data = await catalogCurationService.approveProduct({
          canonicalProductId: req.params.canonicalProductId,
          conceptId: parsed.data.conceptId,
          promoteToGlobal: parsed.data.promoteToGlobal === true,
          curatorActorId: curator,
          tenantId: req.tenant!.id,
          requesterGlobalUserId: sub.globalUserId ?? null, // gate-duplo: o sink re-verifica a plataforma
        });
        return reply.send({ ok: true, data });
      } catch (err) {
        if (isKnownError(err)) return reply.status(err.statusCode).send({ ok: false, code: err.code, message: err.message });
        throw err;
      }
    }
  );

  fastify.post<{ Params: { canonicalProductId: string } }>(
    '/curation/products/:canonicalProductId/reject',
    { preHandler: [fastify.requireRole(['admin'])] },
    async (req, reply) => {
      const sub = subject(req as never);
      if (!sub) return reply.status(401).send({ ok: false, code: 'UNAUTHENTICATED' });
      const curator = await curatorActorId(req.tenant!.id, sub.userId);
      if (!curator) return reply.status(403).send({ ok: false, code: 'CURATOR_ACTOR_MISSING' });
      try {
        await catalogCurationService.rejectProduct({
          canonicalProductId: req.params.canonicalProductId,
          curatorActorId: curator,
          tenantId: req.tenant!.id,
        });
        return reply.send({ ok: true });
      } catch (err) {
        if (isKnownError(err)) return reply.status(err.statusCode).send({ ok: false, code: err.code, message: err.message });
        throw err;
      }
    }
  );

  fastify.post(
    '/curation/products/merge',
    { preHandler: [fastify.requireRole(['admin'])] },
    async (req, reply) => {
      const sub = subject(req as never);
      if (!sub) return reply.status(401).send({ ok: false, code: 'UNAUTHENTICATED' });
      const parsed = mergeSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ ok: false, code: 'CURATION_BAD_REQUEST', issues: parsed.error.issues });
      }
      const curator = await curatorActorId(req.tenant!.id, sub.userId);
      if (!curator) return reply.status(403).send({ ok: false, code: 'CURATOR_ACTOR_MISSING' });
      try {
        await catalogCurationService.mergeProducts({
          duplicateCanonicalProductId: parsed.data.duplicateId,
          winnerCanonicalProductId: parsed.data.winnerId,
          curatorActorId: curator,
          tenantId: req.tenant!.id,
        });
        return reply.send({ ok: true });
      } catch (err) {
        if (isKnownError(err)) return reply.status(err.statusCode).send({ ok: false, code: err.code, message: err.message });
        throw err;
      }
    }
  );

  fastify.post(
    '/curation/variants/merge',
    { preHandler: [fastify.requireRole(['admin'])] },
    async (req, reply) => {
      const sub = subject(req as never);
      if (!sub) return reply.status(401).send({ ok: false, code: 'UNAUTHENTICATED' });
      const parsed = mergeSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ ok: false, code: 'CURATION_BAD_REQUEST', issues: parsed.error.issues });
      }
      const curator = await curatorActorId(req.tenant!.id, sub.userId);
      if (!curator) return reply.status(403).send({ ok: false, code: 'CURATOR_ACTOR_MISSING' });
      try {
        await canonicalVariantService.mergeInto({
          duplicateVariantId: parsed.data.duplicateId,
          winnerVariantId: parsed.data.winnerId,
          actorId: curator,
          tenantId: req.tenant!.id,
        });
        return reply.send({ ok: true });
      } catch (err) {
        if (isKnownError(err)) return reply.status(err.statusCode).send({ ok: false, code: err.code, message: err.message });
        throw err;
      }
    }
  );

  fastify.post<{ Params: { canonicalServiceId: string } }>(
    '/curation/services/:canonicalServiceId/approve',
    { preHandler: [fastify.requireRole(['admin'])] },
    async (req, reply) => {
      const sub = subject(req as never);
      if (!sub) return reply.status(401).send({ ok: false, code: 'UNAUTHENTICATED' });
      const curator = await curatorActorId(req.tenant!.id, sub.userId);
      if (!curator) return reply.status(403).send({ ok: false, code: 'CURATOR_ACTOR_MISSING' });
      try {
        const data = await canonicalServiceService.approve({
          canonicalServiceId: req.params.canonicalServiceId,
          actorId: curator,
        });
        return reply.send({ ok: true, data });
      } catch (err) {
        if (isKnownError(err)) return reply.status(err.statusCode).send({ ok: false, code: err.code, message: err.message });
        throw err;
      }
    }
  );

  // D2 FIX (F-SERVICE-CURATION-HARDENING-BEFORE-UI): reject de SERVIÇO — paridade com produto (que já
  // tinha). pending_curation → retired + evento append-only service_curation_rejected (razão no payload).
  fastify.post<{ Params: { canonicalServiceId: string }; Body: { reason?: string } }>(
    '/curation/services/:canonicalServiceId/reject',
    { preHandler: [fastify.requireRole(['admin'])] },
    async (req, reply) => {
      const sub = subject(req as never);
      if (!sub) return reply.status(401).send({ ok: false, code: 'UNAUTHENTICATED' });
      const curator = await curatorActorId(req.tenant!.id, sub.userId);
      if (!curator) return reply.status(403).send({ ok: false, code: 'CURATOR_ACTOR_MISSING' });
      try {
        await canonicalServiceService.reject({
          canonicalServiceId: req.params.canonicalServiceId,
          actorId: curator,
          tenantId: req.tenant!.id,
          reason: typeof req.body?.reason === 'string' ? req.body.reason : undefined,
        });
        return reply.send({ ok: true });
      } catch (err) {
        if (isKnownError(err)) return reply.status(err.statusCode).send({ ok: false, code: err.code, message: err.message });
        throw err;
      }
    }
  );

  fastify.post(
    '/curation/services/merge',
    { preHandler: [fastify.requireRole(['admin'])] },
    async (req, reply) => {
      const sub = subject(req as never);
      if (!sub) return reply.status(401).send({ ok: false, code: 'UNAUTHENTICATED' });
      const parsed = mergeSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ ok: false, code: 'CURATION_BAD_REQUEST', issues: parsed.error.issues });
      }
      const curator = await curatorActorId(req.tenant!.id, sub.userId);
      if (!curator) return reply.status(403).send({ ok: false, code: 'CURATOR_ACTOR_MISSING' });
      try {
        await canonicalServiceService.mergeInto({
          duplicateId: parsed.data.duplicateId,
          winnerId: parsed.data.winnerId,
          actorId: curator,
        });
        return reply.send({ ok: true });
      } catch (err) {
        if (isKnownError(err)) return reply.status(err.statusCode).send({ ok: false, code: err.code, message: err.message });
        throw err;
      }
    }
  );
};

export default catalogGovernanceRoutes;
