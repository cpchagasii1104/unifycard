// backend/src/modules/relationships/actor-relationship.routes.ts
// F-ACTOR-RELATIONSHIP-TYPED-EDGE-SLICE-1 — rotas da aresta de relação tipada (conectar/responder/ler).
//
// AUTORIDADE (DECISION-0113, catraca blindada): actorId do actionContext é HINT — o principal
// autenticado DEVE representar o actor via canRepresentActor, fail-closed 403, no ENVIO e no ACEITE.
// RELAÇÃO ≠ AUTORIDADE: nenhuma rota aqui concede poder; aceitar 'colaborador' não escreve
// company_users (o grant é ato separado do dono — fatia de onboarding).

import type { FastifyInstance } from 'fastify';
import { actorRelationshipService } from './actor-relationship.service';
import { authorizationService } from '@core/authorization/authorization.service';
import type { RelationshipFilters, RespondRelationshipInput, SendRelationshipInput } from './actor-relationship.types';

async function assertRepresentsActor(req: any, reply: any, actorId: string): Promise<boolean> {
  const userId = req.user?.userId ?? req.user?.id;
  if (!userId) {
    reply.status(401).send({ error: 'Authentication required' });
    return false;
  }
  let ok = false;
  try {
    ok = await authorizationService.canRepresentActor(req.tenant.id, userId, actorId);
  } catch {
    ok = false;
  }
  if (!ok) {
    reply.status(403).send({ error: 'Sem autoridade para representar este actor' });
    return false;
  }
  return true;
}

const actorRelationshipRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /relationships — enviar pedido de conexão JÁ classificando o outro
   * (from = actor PROVADO do actionContext; toActorId/label vêm do body como RECURSO/semântica,
   * nunca como autoridade).
   */
  fastify.post<{ Body: SendRelationshipInput }>('/relationships', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });
    }
    if (!(await assertRepresentsActor(req, reply, actionContext.actorId))) return reply;

    const userId = (req as any).user?.userId ?? (req as any).user?.id;
    try {
      const edge = await actorRelationshipService.sendRequest(tenantId, actionContext.actorId, userId, req.body ?? ({} as SendRelationshipInput));
      return reply.status(201).send({ ok: true, data: edge });
    } catch (err: any) {
      const status = err?.statusCode ?? 500;
      return reply.status(status).send({ ok: false, error: err?.message ?? 'Erro ao criar relação' });
    }
  });

  /**
   * POST /relationships/:id/respond — aceite CLASSIFICADO ({action:'accept', targetLabel}) ou
   * rejeição ({action:'reject'}). Só o actor DESTINO da aresta (provado) responde.
   */
  fastify.post<{ Params: { id: string }; Body: RespondRelationshipInput }>(
    '/relationships/:id/respond',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const actionContext = (req as any).actionContext;
      if (!actionContext || !actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });
      }
      if (!(await assertRepresentsActor(req, reply, actionContext.actorId))) return reply;

      const userId = (req as any).user?.userId ?? (req as any).user?.id;
      try {
        const edge = await actorRelationshipService.respond(
          tenantId,
          actionContext.actorId,
          userId,
          req.params.id,
          req.body ?? ({} as RespondRelationshipInput)
        );
        return reply.send({ ok: true, data: edge });
      } catch (err: any) {
        const status = err?.statusCode ?? 500;
        return reply.status(status).send({ ok: false, error: err?.message ?? 'Erro ao responder relação' });
      }
    }
  );

  /**
   * PATCH /relationships/:id/label — reclassificar O MEU LADO da aresta
   * (ex.: conhecido → amigo). Só participante PROVADO; o service valida par/vocabulário/side.
   */
  fastify.patch<{ Params: { id: string }; Body: { label?: string } }>(
    '/relationships/:id/label',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const actionContext = (req as any).actionContext;
      if (!actionContext || !actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });
      }
      if (!(await assertRepresentsActor(req, reply, actionContext.actorId))) return reply;

      try {
        const edge = await actorRelationshipService.reclassify(
          tenantId,
          actionContext.actorId,
          req.params.id,
          req.body?.label
        );
        return reply.send({ ok: true, data: edge });
      } catch (err: any) {
        const status = err?.statusCode ?? 500;
        return reply.status(status).send({ ok: false, error: err?.message ?? 'Erro ao reclassificar relação' });
      }
    }
  );

  /**
   * PATCH /relationships/:id/feed-priority — frequência de feed DO MEU LADO
   * (padrao|ver_primeiro|ver_mais|ver_menos). Só participante PROVADO.
   */
  fastify.patch<{ Params: { id: string }; Body: { priority?: string } }>(
    '/relationships/:id/feed-priority',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const actionContext = (req as any).actionContext;
      if (!actionContext || !actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });
      }
      if (!(await assertRepresentsActor(req, reply, actionContext.actorId))) return reply;

      try {
        const edge = await actorRelationshipService.reclassifyFeedPriority(
          tenantId,
          actionContext.actorId,
          req.params.id,
          req.body?.priority
        );
        return reply.send({ ok: true, data: edge });
      } catch (err: any) {
        const status = err?.statusCode ?? 500;
        return reply.status(status).send({ ok: false, error: err?.message ?? 'Erro ao ajustar frequência' });
      }
    }
  );

  /**
   * GET /relationships/mine — as conexões do actor PROVADO (dos dois lados da aresta).
   * ?label=fornecedor = a projeção CRM ("meus fornecedores" pela MINHA ótica da aresta).
   */
  fastify.get<{ Querystring: { status?: string; label?: string; limit?: number; offset?: number } }>(
    '/relationships/mine',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const actionContext = (req as any).actionContext;
      if (!actionContext || !actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });
      }
      if (!(await assertRepresentsActor(req, reply, actionContext.actorId))) return reply;

      const filters: RelationshipFilters = {};
      if (req.query.status) filters.status = req.query.status as any;
      if (req.query.label) filters.label = req.query.label as any;
      if (req.query.limit) filters.limit = Number(req.query.limit);
      if (req.query.offset) filters.offset = Number(req.query.offset);

      const edges = await actorRelationshipService.listMine(tenantId, actionContext.actorId, filters);
      return reply.send({ ok: true, data: edges, total: edges.length });
    }
  );

  /**
   * GET /relationships/pending-received — solicitações de conexão RECEBIDAS pelo actor PROVADO,
   * com allowedTargetLabels por item (regra de par server-side) pro ACEITE CLASSIFICADO.
   */
  fastify.get('/relationships/pending-received', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });
    }
    if (!(await assertRepresentsActor(req, reply, actionContext.actorId))) return reply;
    const items = await actorRelationshipService.listPendingReceived(tenantId, actionContext.actorId);
    return reply.send({ ok: true, data: items, total: items.length });
  });
};

export default actorRelationshipRoutes;
