// backend/src/modules/asset-sale/asset-sale.routes.ts
// F-ASSET-MULTI-OFFER-FOUNDATION Fatia 3 — superfície HTTP da VENDA asset-first. owner_actor_id NUNCA vem do
// body: é o actionContext.actorId, provado por canRepresentActor (D-α: PF e PJ, sem PRODUCT_PUBLISH_PJ_ONLY).
// Preço = anúncio (Δbank=0). NÃO toca products/product_offers/Bank/orders/checkout.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { assetSaleService } from './asset-sale.service';
import { authorizationService } from '@core/authorization/authorization.service';
import { ASSET_CONDITIONS, ASSET_SALE_STATUSES } from '@core/assets/asset.types';

const visibilityEnum = z.enum(['public', 'connections', 'only_me']);

// Entrada polimórfica (Fatia 3R): OU `assetId` (ativar venda em item JÁ existente, preserva identidade única)
// OU `conceptId`+`label` (cadastrar item novo à venda). conceptId/label opcionais no schema; o handler exige
// um dos dois caminhos. Ativar sobre asset existente = NÃO cria outro actor_asset (mata identidade paralela).
const createSchema = z.object({
  assetId: z.string().uuid().optional(),
  conceptId: z.string().uuid().optional(),
  label: z.string().min(1).max(200).optional(),
  condition: z.enum(ASSET_CONDITIONS).nullable().optional(),
  priceCents: z.number().int().min(0).nullable().optional(), // anúncio (cents/BIGINT)
  visibility: visibilityEnum.optional(),
  audienceRelationshipTypes: z.array(z.string()).nullable().optional(),
  negotiable: z.boolean().optional(),
  saleNotes: z.string().max(2000).nullable().optional(),
});

const updateSchema = z.object({
  condition: z.enum(ASSET_CONDITIONS).nullable().optional(),
  priceCents: z.number().int().min(0).nullable().optional(),
  visibility: visibilityEnum.optional(),
  audienceRelationshipTypes: z.array(z.string()).nullable().optional(),
  negotiable: z.boolean().optional(),
  saleNotes: z.string().max(2000).nullable().optional(),
});

const statusSchema = z.object({ status: z.enum(ASSET_SALE_STATUSES) });

const assetSaleRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /asset-sales — põe um bem durável individual à venda. Entrada polimórfica (Fatia 3R):
   *  · `assetId` → ATIVA venda em item JÁ existente (ex.: já cadastrado p/ locação). NÃO cria outro
   *    actor_asset — preserva a identidade única. Autoridade = canRepresentActor sobre o owner REGISTRADO
   *    do asset (no service).
   *  · `conceptId`+`label` → CADASTRA item novo à venda. owner = actionContext.actorId (canRepresentActor).
   */
  fastify.post<{ Body: z.infer<typeof createSchema> }>('/', async (req, reply) => {
    if (!req.tenant?.id) return reply.status(400).send({ error: 'Tenant não encontrado' });
    const userId = (req.user as { userId?: string } | undefined)?.userId;
    if (!userId) return reply.status(401).send({ error: 'Autenticação obrigatória' });
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ ok: false, error: parsed.error.flatten() });

    const commonTerms = {
      condition: parsed.data.condition ?? null,
      priceCents: parsed.data.priceCents ?? null,
      visibility: parsed.data.visibility ?? 'public' as const,
      audienceRelationshipTypes: parsed.data.audienceRelationshipTypes ?? null,
      negotiable: parsed.data.negotiable ?? false,
      saleNotes: parsed.data.saleNotes ?? null,
    };

    try {
      // (A) ATIVAR venda em asset EXISTENTE — autoridade sobre o owner do asset é provada no service.
      if (parsed.data.assetId) {
        const offer = await assetSaleService.activateSaleOnExisting(req.tenant.id, parsed.data.assetId, userId, {
          conceptId: '', label: '', ...commonTerms,
          conditionTouched: parsed.data.condition !== undefined,
        });
        return reply.status(200).send({ ok: true, data: offer });
      }

      // (B) CADASTRAR item novo à venda — owner = actionContext.actorId, canRepresentActor inline (D-α).
      const ownerActorId = req.actionContext?.actorId;
      if (!ownerActorId) return reply.status(400).send({ error: 'ActionContext obrigatório' });
      if (!parsed.data.conceptId || !parsed.data.label) return reply.status(400).send({ ok: false, code: 'ASSET_SALE_NEW_ITEM_REQUIRES_CONCEPT_LABEL', error: 'Item novo exige conceptId e label (ou informe assetId de item existente).' });
      // DECISION-0113: só declara venda REPRESENTANDO o actor dono (server-side, fail-closed). D-α: PF e PJ.
      let canRep = false;
      try { canRep = await authorizationService.canRepresentActor(req.tenant.id, userId, ownerActorId); }
      catch { canRep = false; }
      if (!canRep) return reply.status(403).send({ ok: false, code: 'ASSET_SALE_NOT_REPRESENTABLE', error: 'Sem autoridade sobre o actor declarado (canRepresentActor)' });
      const offer = await assetSaleService.create(req.tenant.id, ownerActorId, userId, {
        conceptId: parsed.data.conceptId, label: parsed.data.label, ...commonTerms,
      });
      return reply.status(201).send({ ok: true, data: offer });
    } catch (err: any) {
      return reply.status(err?.statusCode ?? 500).send({ ok: false, error: err?.message ?? 'Erro ao criar/ativar venda' });
    }
  });

  /** GET /asset-sales?ownerActorId= — minhas vendas (gestão do dono; canRepresentActor). */
  fastify.get<{ Querystring: { ownerActorId?: string } }>('/', async (req, reply) => {
    if (!req.tenant?.id) return reply.status(400).send({ error: 'Tenant não encontrado' });
    const userId = (req.user as { userId?: string } | undefined)?.userId;
    if (!userId) return reply.status(401).send({ error: 'Autenticação obrigatória' });
    const ownerActorId = req.query.ownerActorId || req.actionContext?.actorId;
    if (!ownerActorId) return reply.status(400).send({ error: 'ownerActorId obrigatório' });
    // DECISION-0113: só lista as vendas do actor que o caller REPRESENTA (server-side, fail-closed).
    let canRep = false;
    try { canRep = await authorizationService.canRepresentActor(req.tenant.id, userId, ownerActorId); }
    catch { canRep = false; }
    if (!canRep) return reply.status(403).send({ ok: false, code: 'ASSET_SALE_LIST_NOT_REPRESENTABLE', error: 'Sem autoridade sobre o owner' });
    try {
      const offers = await assetSaleService.listMine(req.tenant.id, ownerActorId, userId);
      return reply.send({ ok: true, data: offers });
    } catch (err: any) {
      return reply.status(err?.statusCode ?? 500).send({ ok: false, error: err?.message ?? 'Erro ao listar vendas' });
    }
  });

  /** GET /asset-sales/vocabularies — vocabulários GOVERNADOS p/ o cliente (D6): status + visibilidade. */
  fastify.get('/vocabularies', async (_req, reply) => {
    const STATUS_LABELS: Record<string, string> = { active: 'Ativo', paused: 'Pausado' };
    const VIS_LABELS: Record<string, string> = { public: 'Público', connections: 'Conexões', only_me: 'Só eu' };
    return reply.send({
      ok: true,
      data: {
        saleStatuses: ASSET_SALE_STATUSES.map((v) => ({ value: v, label: STATUS_LABELS[v] ?? v })),
        visibilities: (['public', 'connections', 'only_me'] as const).map((v) => ({ value: v, label: VIS_LABELS[v] ?? v })),
      },
    });
  });

  /** GET /asset-sales/:id — detalhe da oferta de venda (read-only). */
  fastify.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    if (!req.tenant?.id) return reply.status(400).send({ error: 'Tenant não encontrado' });
    try {
      const offer = await assetSaleService.get(req.tenant.id, req.params.id);
      return reply.send({ ok: true, data: offer });
    } catch (err: any) {
      return reply.status(err?.statusCode ?? 500).send({ ok: false, error: err?.message ?? 'Erro' });
    }
  });

  /** PATCH /asset-sales/:id — edita a oferta (owner-only). */
  fastify.patch<{ Params: { id: string }; Body: z.infer<typeof updateSchema> }>('/:id', async (req, reply) => {
    if (!req.tenant?.id) return reply.status(400).send({ error: 'Tenant não encontrado' });
    const userId = (req.user as { userId?: string } | undefined)?.userId;
    if (!userId) return reply.status(401).send({ error: 'Autenticação obrigatória' });
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ ok: false, error: parsed.error.flatten() });
    try {
      const offer = await assetSaleService.update(req.tenant.id, req.params.id, userId, {
        condition: parsed.data.condition,
        priceCents: parsed.data.priceCents,
        visibility: parsed.data.visibility,
        audienceRelationshipTypes: parsed.data.audienceRelationshipTypes,
        negotiable: parsed.data.negotiable,
        saleNotes: parsed.data.saleNotes,
      });
      return reply.send({ ok: true, data: offer });
    } catch (err: any) {
      return reply.status(err?.statusCode ?? 500).send({ ok: false, error: err?.message ?? 'Erro ao editar venda' });
    }
  });

  /** PATCH /asset-sales/:id/status — active/paused (owner-only). */
  fastify.patch<{ Params: { id: string }; Body: z.infer<typeof statusSchema> }>('/:id/status', async (req, reply) => {
    if (!req.tenant?.id) return reply.status(400).send({ error: 'Tenant não encontrado' });
    const userId = (req.user as { userId?: string } | undefined)?.userId;
    if (!userId) return reply.status(401).send({ error: 'Autenticação obrigatória' });
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ ok: false, error: parsed.error.flatten() });
    try {
      const offer = await assetSaleService.updateStatus(req.tenant.id, req.params.id, userId, parsed.data.status);
      return reply.send({ ok: true, data: offer });
    } catch (err: any) {
      return reply.status(err?.statusCode ?? 500).send({ ok: false, error: err?.message ?? 'Erro ao mudar status' });
    }
  });
};

export default assetSaleRoutes;
