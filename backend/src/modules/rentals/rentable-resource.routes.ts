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

const resourceTypeEnum = z.enum(['equipment', 'vehicle', 'property', 'space']);
const statusEnum = z.enum(['active', 'paused', 'retired']);

const createSchema = z.object({
  conceptId: z.string().uuid(),
  resourceType: resourceTypeEnum,
  label: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  pricingUnit: z.enum(RENTAL_PRICING_UNITS).nullable().optional(),
  priceCents: z.number().int().min(0).nullable().optional(),
  // Ano: fato escalar tipado (não CONCEPT, não texto livre — fix Clayton/2ª IA)
  resourceYear: z.number().int().min(1900).max(new Date().getFullYear() + 1).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
  // Plateia (Clayton 2026-07-07): macro + refinamento. A LISTA de opções vem do transversal
  // /audience-options; aqui só valida o vocabulário do substrato (o banco é a última linha).
  visibility: z.enum(['public', 'connections', 'only_me']).optional(),
  audienceRelationshipTypes: z.array(z.string()).nullable().optional(),
  // Localização governada: cityId da SSOT `cities` (UUID). NUNCA city_name livre. Backend valida.
  cityId: z.string().uuid().nullable().optional(),
  // Fase 1: faixas de preço anunciado. priceCents (cents/BIGINT), nunca reais. Unidade governada.
  pricingTiers: z.array(z.object({
    unit: z.enum(RENTAL_PRICING_UNITS),
    priceCents: z.number().int().min(0),
  })).optional(),
  // Fase 3: quantidade (equipment pode >1; veículo/imóvel/espaço travados em 1 no service).
  quantity: z.number().int().min(1).optional(),
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
        resourceYear: parsed.data.resourceYear ?? null,
        metadata: parsed.data.metadata ?? {},
        visibility: parsed.data.visibility ?? 'public',
        audienceRelationshipTypes: parsed.data.audienceRelationshipTypes ?? null,
        cityId: parsed.data.cityId ?? null,
        pricingTiers: (parsed.data.pricingTiers ?? []).map((t) => ({ unit: t.unit, priceCents: t.priceCents })),
        quantity: parsed.data.quantity ?? 1,
      });
      return reply.status(201).send({ ok: true, data: resource });
    } catch (err: any) {
      const status = err?.statusCode ?? 500;
      return reply.status(status).send({ ok: false, error: err?.message ?? 'Erro ao criar recurso' });
    }
  });

  /**
   * GET /rentable-resources
   * Dois modos: ?ownerActorId= = "meus recursos" (gestão do dono, sem filtro de plateia — é o
   * próprio dono). ?discover=true = DESCOBERTA (consumir): recursos ATIVOS de terceiros filtrados
   * pela PLATEIA do dono (enforcement no banco, viewer server-side = actionContext.actorId).
   * Frontend NÃO cria verdade: a visibilidade é decidida pelo backend, não pela tela.
   */
  fastify.get<{ Querystring: { ownerActorId?: string; status?: string; limit?: string; offset?: string; discover?: string } }>(
    '/',
    async (req, reply) => {
      if (!req.tenant?.id) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }
      // DESCOBERTA: viewer server-side + filtro de plateia do dono.
      if (req.query.discover === 'true') {
        const viewerActorId = req.actionContext?.actorId;
        if (!viewerActorId) {
          return reply.status(400).send({ error: 'ActionContext obrigatório para descoberta' });
        }
        const resources = await rentableResourceService.listDiscoverable(
          req.tenant.id, viewerActorId, req.query.limit ? parseInt(req.query.limit, 10) : undefined);
        return reply.send({ ok: true, data: resources });
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
   * GET /rentable-resources/:id/price-estimate?startAt=&endAt= — ESTIMATIVA (Fase 2, PRÉ-DINHEIRO).
   * Backend calcula das faixas declaradas; não cria cobrança/reserva. Valores em cents. Read-only.
   */
  fastify.get<{ Params: { id: string }; Querystring: { startAt?: string; endAt?: string } }>(
    '/:id/price-estimate',
    async (req, reply) => {
      if (!req.tenant?.id) return reply.status(400).send({ error: 'Tenant não encontrado' });
      const start = new Date(req.query.startAt ?? '');
      const end = new Date(req.query.endAt ?? '');
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return reply.status(400).send({ error: 'startAt/endAt inválidos (ISO 8601)' });
      }
      const estimate = await rentableResourceService.estimatePrice(req.tenant.id, req.params.id, start, end);
      return reply.send({ ok: true, data: estimate });
    }
  );

  /**
   * GET /rentable-resources/concepts?resourceType=&q=
   * Catálogo GOVERNADO filtrado por tipo + oferta (fix 2ª IA 2026-07-07: "lista curada" virou
   * GOVERNANÇA real via concept_offer_kinds — não array hardcoded). Dois filtros compostos:
   * 1) domínio N0 do tipo (RESOURCE_TYPE_TO_DOMAINS, coarse) 2) offer_kind='rentable' (fine —
   * exclui motoboy/guincho/mudança, que são serviços contratáveis do mesmo N0, não bens alugáveis).
   */
  fastify.get<{ Querystring: { resourceType?: string; q?: string; useArea?: string } }>('/concepts', async (req, reply) => {
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }
    // resourceType OBRIGATÓRIO (2026-07-07, GO Clayton): sem ele, retornava o catálogo inteiro —
    // fallback banido junto com o 'other'. Todo tipo válido tem domínio não-vazio.
    const rtParsed = resourceTypeEnum.safeParse(req.query.resourceType);
    if (!rtParsed.success) {
      return reply.status(400).send({ error: 'resourceType obrigatório e válido (equipment|vehicle|property|space)' });
    }
    const domains = RESOURCE_TYPE_TO_DOMAINS[rtParsed.data];
    const q = (req.query.q ?? '').trim();
    // useArea (RFC-RENTAL-EQUIPMENT-USE-AREAS-MVP): faceta GOVERNADA de uso; filtra os concepts da área.
    // Só se aplica a equipment; ausente = todos (comportamento de hoje). O código da área é validado
    // contra a tabela governada (JOIN) — não confia na string do cliente.
    const useArea = (req.query.useArea ?? '').trim();

    const { runQueriesWithTenant } = await import('@core/database/pool');
    const params: unknown[] = [domains];
    let where = `cs.tenant_id IS NULL AND cs.status = 'active' AND cok.offer_kind = 'rentable' AND c.domain = ANY($1)`;
    if (q) {
      params.push(`%${q}%`);
      where += ` AND cs.name ILIKE $${params.length}`;
    }
    let useAreaJoin = '';
    if (useArea) {
      params.push(useArea);
      useAreaJoin = `JOIN rental_equipment_use_area_concepts m ON m.concept_id = c.concept_id
         JOIN rental_equipment_use_areas a ON a.id = m.use_area_id AND a.is_active AND a.code = $${params.length}`;
    }
    const rows = await runQueriesWithTenant<{ concept_id: string; slug: string; domain: string; label: string }>(
      req.tenant.id,
      `SELECT DISTINCT ON (c.concept_id) c.concept_id::text, c.slug, c.domain, cs.name AS label
         FROM concepts c
         JOIN canonical_services cs ON cs.concept_id = c.concept_id
         JOIN concept_offer_kinds cok ON cok.concept_id = c.concept_id
         ${useAreaJoin}
        WHERE ${where}
        ORDER BY c.concept_id, cs.created_at ASC`,
      params
    );
    rows.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
    return reply.send({ ok: true, data: rows });
  });

  /**
   * GET /rentable-resources/equipment-use-areas — faceta GOVERNADA de uso (áreas ativas + contagem).
   * Fonte da projeção de navegação de equipamentos (frontend só renderiza). Read-only.
   */
  fastify.get('/equipment-use-areas', async (req, reply) => {
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }
    const { runQueriesWithTenant } = await import('@core/database/pool');
    const rows = await runQueriesWithTenant<{ code: string; label: string; concept_count: number }>(
      req.tenant.id,
      `SELECT a.code, a.label, count(m.concept_id)::int AS concept_count
         FROM rental_equipment_use_areas a
         LEFT JOIN rental_equipment_use_area_concepts m ON m.use_area_id = a.id
        WHERE a.is_active
        GROUP BY a.id, a.code, a.label, a.sort_order
        ORDER BY a.sort_order ASC`,
      []
    );
    return reply.send({ ok: true, data: rows });
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
