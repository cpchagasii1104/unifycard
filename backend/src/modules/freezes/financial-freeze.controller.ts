// Financial Freeze Controller — CONTIDO.
//
// 🔴 CONTENÇÃO P1 — F-INTERNAL-FINANCIAL-AUTHORITY-CONTAINMENT (fail-closed, 501).
// Registrado em `/internal` FORA do protectedScope (app cru, sem authPlugin/tenantPlugin/rbacPlugin):
// lia `tenant_id`+`amount_cents` do BODY (POST/PATCH) e `tenant_id` da QUERY (GET) como AUTORIDADE,
// gravando financial_freezes / financial_alerts sem subject server-side. `tenant_id` declarado pelo
// cliente NÃO é autoridade (DECISION-0113; tenant vem server-side de req.tenant/req.user). As 4 rotas
// foram reduzidas a 501 INTERNAL_FINANCIAL_AUTHORITY_CONTAINED até existir subject interno autenticado
// server-side dentro do protectedScope (frente própria). Repositórios (financial-freeze-repository,
// financial-alert-repository) permanecem INTACTOS p/ um futuro caller seguro. Zero Bank/Core/payout/worker.

import type { FastifyPluginAsync } from 'fastify';

const CONTAINED = {
  ok: false,
  code: 'INTERNAL_FINANCIAL_AUTHORITY_CONTAINED',
  message:
    'Internal financial HTTP surface contained until server-side internal subject authority exists (no body/query tenant_id authority).',
} as const;

const financialFreezeController: FastifyPluginAsync = async (app) => {
  // POST /financial/freezes — CONTIDO (lia tenant_id+amount_cents do body; gravava freeze+alert).
  app.post('/financial/freezes', async (_req, reply) => reply.status(501).send(CONTAINED));
  // GET /financial/freezes — CONTIDO (lia tenant_id da query; listava freezes).
  app.get('/financial/freezes', async (_req, reply) => reply.status(501).send(CONTAINED));
  // PATCH /financial/freezes/:id/release — CONTIDO (lia tenant_id do body).
  app.patch('/financial/freezes/:id/release', async (_req, reply) => reply.status(501).send(CONTAINED));
  // PATCH /financial/freezes/:id/cancel — CONTIDO (lia tenant_id do body).
  app.patch('/financial/freezes/:id/cancel', async (_req, reply) => reply.status(501).send(CONTAINED));
};

export default financialFreezeController;
