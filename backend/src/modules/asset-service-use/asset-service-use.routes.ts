// backend/src/modules/asset-service-use/asset-service-use.routes.ts
// F-ASSET-MULTI-OFFER-FOUNDATION Fatia 4B — superfície HTTP do vínculo de uso operacional. assetId sempre de
// item JÁ existente (Fatia 4B não cadastra item novo). operador NUNCA vem do body — v1 = dono-operador
// (derivado server-side no service). NÃO toca Bank/orders/checkout/booking/RFQ.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { assetServiceUseService } from './asset-service-use.service';
import { OPERATIONAL_ARRANGEMENTS, ASSET_SERVICE_USE_STATUSES } from '@core/assets/asset.types';

const createSchema = z.object({
  assetId: z.string().uuid(),
  serviceConceptId: z.string().uuid(),
  arrangementType: z.enum(OPERATIONAL_ARRANGEMENTS),
});

const statusSchema = z.object({ status: z.enum(ASSET_SERVICE_USE_STATUSES) });

const assetServiceUseRoutes: FastifyPluginAsync = async (fastify) => {
  /** POST /asset-service-uses — ativa uso operacional sobre um asset JÁ EXISTENTE (v1: dono-operador). */
  fastify.post<{ Body: z.infer<typeof createSchema> }>('/', async (req, reply) => {
    if (!req.tenant?.id) return reply.status(400).send({ error: 'Tenant não encontrado' });
    const userId = (req.user as { userId?: string } | undefined)?.userId;
    if (!userId) return reply.status(401).send({ error: 'Autenticação obrigatória' });
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ ok: false, error: parsed.error.flatten() });

    try {
      const usage = await assetServiceUseService.activateOnExisting(req.tenant.id, parsed.data.assetId, userId, {
        assetId: parsed.data.assetId,
        serviceConceptId: parsed.data.serviceConceptId,
        arrangementType: parsed.data.arrangementType,
      });
      return reply.status(200).send({ ok: true, data: usage });
    } catch (err: any) {
      return reply.status(err?.statusCode ?? 500).send({ ok: false, error: err?.message ?? 'Erro ao ativar uso operacional' });
    }
  });

  /** GET /asset-service-uses?ownerActorId= — meus usos operacionais (gestão do dono; canRepresentActor).
   *  ownerActorId é SEMPRE explícito na querystring (DECISION-0113 / audit-actor-authority-boundary: rota
   *  NOVA não lê actionContext.actorId como canal implícito) — autoridade provada no service (canRepresentActor). */
  fastify.get<{ Querystring: { ownerActorId?: string } }>('/', async (req, reply) => {
    if (!req.tenant?.id) return reply.status(400).send({ error: 'Tenant não encontrado' });
    const userId = (req.user as { userId?: string } | undefined)?.userId;
    if (!userId) return reply.status(401).send({ error: 'Autenticação obrigatória' });
    const ownerActorId = req.query.ownerActorId;
    if (!ownerActorId) return reply.status(400).send({ error: 'ownerActorId obrigatório' });
    try {
      const usages = await assetServiceUseService.listMine(req.tenant.id, ownerActorId, userId);
      return reply.send({ ok: true, data: usages });
    } catch (err: any) {
      return reply.status(err?.statusCode ?? 500).send({ ok: false, error: err?.message ?? 'Erro ao listar usos operacionais' });
    }
  });

  /** GET /asset-service-uses/vocabularies — vocabulários GOVERNADOS p/ o cliente: arranjo + status. */
  fastify.get('/vocabularies', async (_req, reply) => {
    const ARRANGEMENT_LABELS: Record<string, string> = {
      daily_fee: 'Diária', shift_fee: 'Turno', fixed_fee: 'Valor fixo',
      commission: 'Comissão', revenue_share: 'Divisão de receita',
    };
    const STATUS_LABELS: Record<string, string> = { active: 'Ativo', paused: 'Pausado' };
    return reply.send({
      ok: true,
      data: {
        arrangementTypes: OPERATIONAL_ARRANGEMENTS.map((v) => ({ value: v, label: ARRANGEMENT_LABELS[v] ?? v })),
        statuses: ASSET_SERVICE_USE_STATUSES.map((v) => ({ value: v, label: STATUS_LABELS[v] ?? v })),
      },
    });
  });

  /** GET /asset-service-uses/:id — detalhe do vínculo (read-only). */
  fastify.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    if (!req.tenant?.id) return reply.status(400).send({ error: 'Tenant não encontrado' });
    try {
      const usage = await assetServiceUseService.get(req.tenant.id, req.params.id);
      return reply.send({ ok: true, data: usage });
    } catch (err: any) {
      return reply.status(err?.statusCode ?? 500).send({ ok: false, error: err?.message ?? 'Erro' });
    }
  });

  /** PATCH /asset-service-uses/:id/status — active/paused (owner-only). */
  fastify.patch<{ Params: { id: string }; Body: z.infer<typeof statusSchema> }>('/:id/status', async (req, reply) => {
    if (!req.tenant?.id) return reply.status(400).send({ error: 'Tenant não encontrado' });
    const userId = (req.user as { userId?: string } | undefined)?.userId;
    if (!userId) return reply.status(401).send({ error: 'Autenticação obrigatória' });
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ ok: false, error: parsed.error.flatten() });
    try {
      const usage = await assetServiceUseService.updateStatus(req.tenant.id, req.params.id, userId, parsed.data.status);
      return reply.send({ ok: true, data: usage });
    } catch (err: any) {
      return reply.status(err?.statusCode ?? 500).send({ ok: false, error: err?.message ?? 'Erro ao mudar status' });
    }
  });
};

export default assetServiceUseRoutes;
