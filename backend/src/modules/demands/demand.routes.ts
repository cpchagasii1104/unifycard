// backend/src/modules/demands/demand.routes.ts
// DECISION-0164 — rotas da demanda de serviço (fatia A).
// CATRACA 0113 (mesmo padrão de relationships): actorId do actionContext é HINT —
// o principal autenticado DEVE representar o actor (canRepresentActor, fail-closed 403).

import type { FastifyInstance } from 'fastify';
import { demandService } from './demand.service';
import { authorizationService } from '@core/authorization/authorization.service';
import type { CreateDemandInput } from './demand.types';

async function assertRepresentsActor(req: any, reply: any, actorId: string): Promise<boolean> {
  const userId = req.user?.userId ?? req.user?.id;
  if (!userId) { reply.status(401).send({ error: 'Authentication required' }); return false; }
  let ok = false;
  try { ok = await authorizationService.canRepresentActor(req.tenant.id, userId, actorId); } catch { ok = false; }
  if (!ok) { reply.status(403).send({ error: 'Sem autoridade para representar este actor' }); return false; }
  return true;
}

function requireContext(req: any, reply: any): string | null {
  const actorId = req.actionContext?.actorId;
  if (!actorId) { reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' }); return null; }
  return actorId;
}

const demandRoutes = async (fastify: FastifyInstance) => {
  /** POST /demands — o emissor posta a demanda (churrascaria pede garçom). */
  fastify.post<{ Body: CreateDemandInput }>('/demands', async (req, reply) => {
    const actorId = requireContext(req, reply); if (!actorId) return reply;
    if (!(await assertRepresentsActor(req, reply, actorId))) return reply;
    try {
      const userId = req.user?.userId ?? req.user?.id;
      const demand = await demandService.create(req.tenant!.id, actorId, req.body ?? ({} as CreateDemandInput), userId);
      return reply.status(201).send({ ok: true, data: demand });
    } catch (err: any) {
      return reply.status(err?.statusCode ?? 500).send({ ok: false, error: err?.message ?? 'Erro ao criar demanda' });
    }
  });

  /**
   * POST /demands/batch — 🔴 F4-b · PEDIDO COM VÁRIOS ITENS (GO Clayton 2026-08-06).
   * N itens do MESMO fornecedor, cada um com a SUA configuração, numa transação só. Multi-item é
   * conveniência de TELA: no banco continuam N demandas comparáveis e aceitáveis uma a uma — se
   * virasse pacote, o fornecedor daria UM preço e a comparação por item morreria.
   */
  fastify.post<{ Body: { targetActorId?: string; eventId?: string; items: CreateDemandInput[] } }>(
    '/demands/batch',
    async (req, reply) => {
      const actorId = requireContext(req, reply); if (!actorId) return reply;
      if (!(await assertRepresentsActor(req, reply, actorId))) return reply;
      try {
        const userId = req.user?.userId ?? req.user?.id;
        const r = await demandService.createBatch(req.tenant!.id, actorId, req.body ?? ({ items: [] } as any), userId);
        return reply.status(201).send({ ok: true, data: r });
      } catch (err: any) {
        return reply.status(err?.statusCode ?? 500).send({ ok: false, error: err?.message ?? 'Erro ao criar pedido' });
      }
    });

  /** GET /demands/mine — demandas do actor emissor. */
  fastify.get('/demands/mine', async (req, reply) => {
    const actorId = requireContext(req, reply); if (!actorId) return reply;
    if (!(await assertRepresentsActor(req, reply, actorId))) return reply;
    const data = await demandService.listMine(req.tenant!.id, actorId);
    return reply.send({ ok: true, data, total: data.length });
  });

  /** GET /demands/opportunities — PULL "ver oportunidades" do provider.
   *  ?matching=true (default) filtra pelos concepts do PERFIL PROFISSIONAL (C1). */
  fastify.get<{ Querystring: { matching?: string } }>('/demands/opportunities', async (req, reply) => {
    const actorId = requireContext(req, reply); if (!actorId) return reply;
    if (!(await assertRepresentsActor(req, reply, actorId))) return reply;
    const onlyMatching = req.query.matching !== 'false';
    const data = await demandService.listOpportunities(req.tenant!.id, actorId, onlyMatching);
    return reply.send({ ok: true, data, total: data.length });
  });

  /** GET /demands/concepts — projeção do catálogo (concepts de trabalho) pro formulário.
   *  Leitura pura do SSOT semântico; SEM texto livre no wizard. */
  fastify.get('/demands/concepts', async (req, reply) => {
    const actorId = requireContext(req, reply); if (!actorId) return reply;
    if (!(await assertRepresentsActor(req, reply, actorId))) return reply;
    const { runQueriesWithTenant } = await import('@core/database/pool');
    // Fix Yala #9: o CATÁLOGO CONTRATÁVEL = concepts com TRÍADE global ativa (não filtro por
    // domínio — jardinagem mora em 'educacao-e-conhecimento' e é contratável). Uma verdade: a tríade.
    const rows = await runQueriesWithTenant<{ concept_id: string; slug: string; domain: string; label: string }>(
      req.tenant!.id,
      // GATE F-OFFER-KIND-SERVICE-GATE: demanda de trabalho/serviço só oferece concept com aplicabilidade
      // 'service' (assunto/tema/formato de evento não é serviço). Espelha o gate do catálogo de serviço.
      `SELECT DISTINCT ON (c.concept_id) c.concept_id::text, c.slug, c.domain, cs.name AS label
         FROM concepts c
         JOIN canonical_services cs ON cs.concept_id = c.concept_id
         JOIN concept_offer_kinds ok ON ok.concept_id = c.concept_id AND ok.offer_kind = 'service'
        WHERE cs.tenant_id IS NULL AND cs.status = 'active'
        ORDER BY c.concept_id, cs.created_at ASC`, []);
    rows.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
    return reply.send({ ok: true, data: rows });
  });

  /** GET /demands/:id — demanda + respostas (completas SÓ pro emissor; provider vê a própria). */
  fastify.get<{ Params: { id: string } }>('/demands/:id', async (req, reply) => {
    const actorId = requireContext(req, reply); if (!actorId) return reply;
    if (!(await assertRepresentsActor(req, reply, actorId))) return reply;
    try {
      const data = await demandService.getWithResponses(req.tenant!.id, actorId, req.params.id);
      return reply.send({ ok: true, data });
    } catch (err: any) {
      return reply.status(err?.statusCode ?? 500).send({ ok: false, error: err?.message ?? 'Erro' });
    }
  });

  /** POST /demands/:id/respond — aceite (automatico) ou candidatura (com_analise). */
  fastify.post<{ Params: { id: string }; Body: { quoteCents?: number; message?: string; offeringId?: string; assetId?: string } }>(
    '/demands/:id/respond', async (req, reply) => {
      const actorId = requireContext(req, reply); if (!actorId) return reply;
      if (!(await assertRepresentsActor(req, reply, actorId))) return reply;
      try {
        const data = await demandService.respond(req.tenant!.id, actorId, req.params.id, req.body ?? {});
        return reply.status(201).send({ ok: true, data });
      } catch (err: any) {
        return reply.status(err?.statusCode ?? 500).send({ ok: false, error: err?.message ?? 'Erro ao responder' });
      }
    });

  /** POST /demands/:id/responses/:responseId/choose — emissor escolhe candidato (com_analise). */
  fastify.post<{ Params: { id: string; responseId: string } }>(
    '/demands/:id/responses/:responseId/choose', async (req, reply) => {
      const actorId = requireContext(req, reply); if (!actorId) return reply;
      if (!(await assertRepresentsActor(req, reply, actorId))) return reply;
      try {
        const data = await demandService.choose(req.tenant!.id, actorId, req.params.id, req.params.responseId);
        return reply.send({ ok: true, data });
      } catch (err: any) {
        return reply.status(err?.statusCode ?? 500).send({ ok: false, error: err?.message ?? 'Erro ao escolher' });
      }
    });

  /** POST /demands/:id/responses/:responseId/withdraw — provider cancela; vaga LIBERA (adendo 3). */
  fastify.post<{ Params: { id: string; responseId: string } }>(
    '/demands/:id/responses/:responseId/withdraw', async (req, reply) => {
      const actorId = requireContext(req, reply); if (!actorId) return reply;
      if (!(await assertRepresentsActor(req, reply, actorId))) return reply;
      try {
        const data = await demandService.withdraw(req.tenant!.id, actorId, req.params.id, req.params.responseId);
        return reply.send({ ok: true, data });
      } catch (err: any) {
        return reply.status(err?.statusCode ?? 500).send({ ok: false, error: err?.message ?? 'Erro ao cancelar' });
      }
    });
};

export default demandRoutes;
