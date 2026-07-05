// backend/src/modules/support-tickets/support-ticket.routes.ts
// F-SUPPORT-TICKET-BUSINESS-FACT-GATE (Fatia 6) — POST /support-tickets · /:id/respond ·
// GET /mine · GET /eligible-references. Autoridade (DECISION-0113): actorId do actionContext é
// HINT — o principal autenticado precisa provar canRepresentActor em TODO handler, fail-closed.

import type { FastifyInstance } from 'fastify';
import { supportTicketService } from './support-ticket.service';
import { authorizationService } from '@core/authorization/authorization.service';
import type { OpenSupportTicketInput, RespondSupportTicketInput } from './support-ticket.types';

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

const supportTicketRoutes = async (fastify: FastifyInstance) => {
  /** POST /support-tickets — abre o Chamado. Gated por FATO DE NEGÓCIO (não por conexão). */
  fastify.post<{ Body: OpenSupportTicketInput }>('/support-tickets', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });
    }
    if (!(await assertRepresentsActor(req, reply, actionContext.actorId))) return reply;

    const userId = (req as any).user?.userId ?? (req as any).user?.id;
    try {
      const ticket = await supportTicketService.openTicket(tenantId, actionContext.actorId, userId, req.body ?? ({} as OpenSupportTicketInput));
      return reply.status(201).send({ ok: true, data: ticket });
    } catch (err: any) {
      const status = err?.statusCode ?? 500;
      return reply.status(status).send({ ok: false, error: err?.message ?? 'Erro ao abrir chamado' });
    }
  });

  /** POST /support-tickets/:id/respond — só as duas partes do PRÓPRIO chamado. */
  fastify.post<{ Params: { id: string }; Body: RespondSupportTicketInput }>(
    '/support-tickets/:id/respond',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const actionContext = (req as any).actionContext;
      if (!actionContext || !actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });
      }
      if (!(await assertRepresentsActor(req, reply, actionContext.actorId))) return reply;

      const userId = (req as any).user?.userId ?? (req as any).user?.id;
      try {
        const ticket = await supportTicketService.respond(tenantId, actionContext.actorId, userId, req.params.id, req.body ?? ({} as RespondSupportTicketInput));
        return reply.send({ ok: true, data: ticket });
      } catch (err: any) {
        const status = err?.statusCode ?? 500;
        return reply.status(status).send({ ok: false, error: err?.message ?? 'Erro ao responder chamado' });
      }
    }
  );

  /** GET /support-tickets/mine — meus chamados (dos dois lados). */
  fastify.get<{ Querystring: { status?: string; limit?: number; offset?: number } }>(
    '/support-tickets/mine',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const actionContext = (req as any).actionContext;
      if (!actionContext || !actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });
      }
      if (!(await assertRepresentsActor(req, reply, actionContext.actorId))) return reply;

      const filters: { status?: any; limit?: number; offset?: number } = {};
      if (req.query.status) filters.status = req.query.status;
      if (req.query.limit) filters.limit = Number(req.query.limit);
      if (req.query.offset) filters.offset = Number(req.query.offset);

      const tickets = await supportTicketService.listMine(tenantId, actionContext.actorId, filters);
      return reply.send({ ok: true, data: tickets, total: tickets.length });
    }
  );

  /**
   * GET /support-tickets/eligible-references?withActorId=X — os fatos de negócio REAIS entre eu
   * (actor provado) e X, pra escolher qual referenciar ao abrir o chamado. Projeção pura,
   * Δbank=0 (só resolve as partes das fontes vivas, nunca escreve).
   */
  fastify.get<{ Querystring: { withActorId?: string } }>(
    '/support-tickets/eligible-references',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const actionContext = (req as any).actionContext;
      if (!actionContext || !actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });
      }
      if (!(await assertRepresentsActor(req, reply, actionContext.actorId))) return reply;
      if (!req.query.withActorId) {
        return reply.status(400).send({ error: 'withActorId é obrigatório' });
      }

      const refs = await supportTicketService.listEligibleReferences(tenantId, actionContext.actorId, req.query.withActorId);
      return reply.send({ ok: true, data: refs });
    }
  );
};

export default supportTicketRoutes;
