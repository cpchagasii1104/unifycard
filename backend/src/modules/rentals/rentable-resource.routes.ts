import { RENTAL_PRICING_UNITS, RESOURCE_TYPE_TO_DOMAINS } from './rentable-resource.types';
// backend/src/modules/rentals/rentable-resource.routes.ts
// F-RENTAL-RESOURCE-SURFACE-SLICE-A — a ÚNICA peça que faltava para o Trilho B (DECISION-0159/
// fluxo.png) funcionar ponta-a-ponta para recurso: registrar o recurso. Availability/booking/
// confirm já são genéricos por owner_type='rentable_resource' (unified-availability, sem mudança
// nesta fatia). Money-free: DECISION-0151 §D veta qualquer coluna/rota financeira aqui.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authorizationService } from '@core/authorization/authorization.service';
import { rentableResourceService } from './rentable-resource.service';

const resourceTypeEnum = z.enum(['equipment', 'vehicle', 'property', 'space', 'other']);
const statusEnum = z.enum(['active', 'paused', 'retired']);

const createSchema = z.object({
  conceptId: z.string().uuid(),
  resourceType: resourceTypeEnum,
  label: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  pricingUnit: z.enum(RENTAL_PRICING_UNITS).nullable().optional(),
  priceCents: z.number().int().min(0).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateStatusSchema = z.object({
  status: statusEnum,
});

const rentableResourceRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /rentable-resources
   * Registra um recurso alugável. owner_actor_id NUNCA vem do body — é o actionContext.actorId
   * do caller, provado via canRepresentActor (mesmo padrão de POST /availability, DECISION-0113
   * canal-1). Aceita actor 'user' ou 'page' como dono.
   */
  fastify.post<{ Body: z.infer<typeof createSchema> }>('/', async (req, reply) => {
    if (!req.actionContext?.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }
    const userId = (req.user as { userId?: string } | undefined)?.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Autenticação obrigatória' });
    }

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.errors });
    }

    let canRep = false;
    try {
      canRep = await authorizationService.canRepresentActor(req.tenant.id, userId, req.actionContext.actorId);
    } catch {
      canRep = false;
    }
    if (!canRep) {
      return reply.status(403).send({
        ok: false,
        error: 'Sem autoridade sobre o actor declarado (canRepresentActor)',
        code: 'RENTABLE_RESOURCE_CREATE_NOT_REPRESENTABLE',
      });
    }

    try {
      const resource = await rentableResourceService.create(req.tenant.id, req.actionContext.actorId, {
        conceptId: parsed.data.conceptId,
        resourceType: parsed.data.resourceType,
        label: parsed.data.label,
        description: parsed.data.description ?? null,
        categoryId: parsed.data.categoryId ?? null,
        pricingUnit: parsed.data.pricingUnit ?? null,
        priceCents: parsed.data.priceCents ?? null,
        metadata: parsed.data.metadata ?? {},
      });
      return reply.status(201).send({ ok: true, data: resource });
    } catch (err: any) {
      const status = err?.statusCode ?? 500;
      return reply.status(status).send({ ok: false, error: err?.message ?? 'Erro ao criar recurso' });
    }
  });

  /**
   * GET /rentable-resources
   * Lista recursos do tenant (RLS já isola). ?ownerActorId= filtra por dono (uso: "meus recursos").
   */
  fastify.get<{ Querystring: { ownerActorId?: string; status?: string; limit?: string; offset?: string } }>(
    '/',
    async (req, reply) => {
      if (!req.tenant?.id) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }
      const statusParsed = req.query.status ? statusEnum.safeParse(req.query.status) : undefined;
      if (statusParsed && !statusParsed.success) {
        return reply.status(400).send({ error: 'status inválido' });
      }
      const resources = await rentableResourceService.list(req.tenant.id, {
        ownerActorId: req.query.ownerActorId,
        status: statusParsed?.success ? statusParsed.data : undefined,
        limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset, 10) : undefined,
      });
      return reply.send({ ok: true, data: resources });
    }
  );

  /**
   * GET /rentable-resources/concepts?resourceType=&q=
   * Catálogo GOVERNADO filtrado por tipo (fix Clayton 2026-07-07: "primeiro seleciono o tipo,
   * aí sim vem a categoria relacionada" — mesma lógica de /demands/concepts). Zero texto livre;
   * o vocabulário RESOURCE_TYPE_TO_DOMAINS decide os N0 elegíveis (doc 18 congelado).
   */
  fastify.get<{ Querystring: { resourceType?: string; q?: string } }>('/concepts', async (req, reply) => {
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }
    const rtParsed = req.query.resourceType ? resourceTypeEnum.safeParse(req.query.resourceType) : undefined;
    if (req.query.resourceType && !rtParsed?.success) {
      return reply.status(400).send({ error: 'resourceType inválido' });
    }
    const domains = rtParsed?.success ? RESOURCE_TYPE_TO_DOMAINS[rtParsed.data] : null;
    const q = (req.query.q ?? '').trim();

    const { runQueriesWithTenant } = await import('@core/database/pool');
    const params: unknown[] = [];
    let where = `cs.tenant_id IS NULL AND cs.status = 'active'`;
    if (domains) {
      params.push(domains);
      where += ` AND c.domain = ANY($${params.length})`;
    }
    if (q) {
      params.push(`%${q}%`);
      where += ` AND cs.name ILIKE $${params.length}`;
    }
    const rows = await runQueriesWithTenant<{ concept_id: string; slug: string; domain: string; label: string }>(
      req.tenant.id,
      `SELECT DISTINCT ON (c.concept_id) c.concept_id::text, c.slug, c.domain, cs.name AS label
         FROM concepts c
         JOIN canonical_services cs ON cs.concept_id = c.concept_id
        WHERE ${where}
        ORDER BY c.concept_id, cs.created_at ASC`,
      params
    );
    rows.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
    return reply.send({ ok: true, data: (domains && domains.length === 0) ? [] : rows });
  });

  /**
   * GET /rentable-resources/:id
   */
  fastify.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }
    try {
      const resource = await rentableResourceService.get(req.tenant.id, req.params.id);
      return reply.send({ ok: true, data: resource });
    } catch (err: any) {
      const status = err?.statusCode ?? 500;
      return reply.status(status).send({ ok: false, error: err?.message ?? 'Erro ao buscar recurso' });
    }
  });

  /**
   * PATCH /rentable-resources/:id/status
   * Owner-only (prova contra o owner_actor_id JÁ REGISTRADO do recurso, não o declarado).
   */
  fastify.patch<{ Params: { id: string }; Body: z.infer<typeof updateStatusSchema> }>(
    '/:id/status',
    async (req, reply) => {
      if (!req.tenant?.id) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }
      const userId = (req.user as { userId?: string } | undefined)?.userId;
      if (!userId) {
        return reply.status(401).send({ error: 'Autenticação obrigatória' });
      }
      const parsed = updateStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.errors });
      }
      try {
        const resource = await rentableResourceService.updateStatus(req.tenant.id, req.params.id, userId, parsed.data.status);
        return reply.send({ ok: true, data: resource });
      } catch (err: any) {
        const status = err?.statusCode ?? 500;
        return reply.status(status).send({ ok: false, error: err?.message ?? 'Erro ao atualizar status' });
      }
    }
  );
};

export default rentableResourceRoutes;
