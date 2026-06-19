// backend/src/modules/automation/automation.routes.ts
// 🔴 R8N AUTOMATION SCHEMA-GHOST CONTAINMENT (DECISION-0113 / Z2 · 2026-06-19):
// Todo o substrato de automation é SCHEMA-GHOST: as tabelas `alerts` e `scheduled_actions` NÃO existem
// (to_regclass=null em unificard_dev) — toda rota de alerts/scheduled-action era dead-at-db. As escritas POST
// /alerts · PATCH /alerts/:id/status · POST /schedule · POST /schedule/:id/cancel ainda liam
// `actionContext.actorId` (canal-1: authorship em scheduled-action; breadcrumb de auditoria em alert). CONTENÇÃO
// fail-closed: as rotas de dados retornam 501 `AUTOMATION_SCHEMA_GHOST_CONTAINED` antes de qualquer service/sink.
// NÃO toca Bank/ledger, NÃO cria migration, NÃO materializa schema. O service `scheduledActionService`
// (incl. executeDueActions) permanece INTOCADO para um futuro worker/caller sistêmico — sem caller humano hoje.
// `POST /schedule/run-due` PRESERVA seu gate próprio (403 AUTOMATION_RUN_DUE_HTTP_DISABLED, guardado por
// audit-internal-surfaces-containment.mjs R18). Reabrir exige schema canônico + binding/worker próprio.

import type { FastifyInstance } from 'fastify';

const AUTOMATION_GHOST_BODY = {
  ok: false,
  code: 'AUTOMATION_SCHEMA_GHOST_CONTAINED',
  error: 'AUTOMATION_SCHEMA_GHOST_CONTAINED',
  message:
    'Automation alerts/scheduled-actions are disabled: their schema is ghost (tables alerts/scheduled_actions do ' +
    'not exist in the canonical schema). Reopening requires a canonical schema + server-side authority binding (and ' +
    'a systemic worker for due-action execution). No money is moved.',
} as const;

const automationRoutes = async (fastify: FastifyInstance) => {
  // ── Alerts (schema-ghost: tabela `alerts` ausente) ──
  fastify.get('/alerts', async (_req, reply) => reply.status(501).send(AUTOMATION_GHOST_BODY));
  fastify.get('/alerts/count', async (_req, reply) => reply.status(501).send(AUTOMATION_GHOST_BODY));
  fastify.get<{ Params: { id: string } }>('/alerts/:id', async (_req, reply) => reply.status(501).send(AUTOMATION_GHOST_BODY));
  fastify.post('/alerts', async (_req, reply) => reply.status(501).send(AUTOMATION_GHOST_BODY));
  fastify.patch<{ Params: { id: string } }>('/alerts/:id/status', async (_req, reply) => reply.status(501).send(AUTOMATION_GHOST_BODY));

  // ── Scheduled actions (schema-ghost: tabela `scheduled_actions` ausente) ──
  fastify.post('/schedule', async (_req, reply) => reply.status(501).send(AUTOMATION_GHOST_BODY));
  fastify.get('/schedule', async (_req, reply) => reply.status(501).send(AUTOMATION_GHOST_BODY));
  fastify.get<{ Params: { id: string } }>('/schedule/:id', async (_req, reply) => reply.status(501).send(AUTOMATION_GHOST_BODY));
  fastify.post<{ Params: { id: string } }>('/schedule/:id/cancel', async (_req, reply) => reply.status(501).send(AUTOMATION_GHOST_BODY));

  /**
   * POST /automation/schedule/run-due
   *
   * 🔴 CONTENÇÃO P1 — F-FINANCIAL-INTERNAL-SURFACES-P1-CONTAINMENT (fail-closed; PRESERVADA em R8N).
   * Varredura de vencidos é trabalho sistêmico, não ação humana via HTTP. `executeDueActions` permanece intacto
   * no service para um futuro worker/internal caller (sem caller humano hoje). NÃO há caminho alcançável que leia
   * `query.now` nem chame `executeDueActions` por esta rota. Ver DT-AUTOMATION-RUN-DUE-HTTP-OPEN + guard R18.
   */
  fastify.post('/schedule/run-due', async (_req, reply) => {
    return reply.status(403).send({
      ok: false,
      code: 'AUTOMATION_RUN_DUE_HTTP_DISABLED',
      message: 'Scheduled due-action execution through this HTTP route is disabled; it must run via an internal/worker caller. Client-supplied time is not execution authority.',
    });
  });
};

export default automationRoutes;
