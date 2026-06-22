// Treasury Account Controller — CONTIDO.
//
// 🔴 CONTENÇÃO P1 — F-INTERNAL-FINANCIAL-AUTHORITY-CONTAINMENT (fail-closed, 501).
// Registrado em `/internal` FORA do protectedScope: lia `tenant_id` do BODY (POST) e da QUERY (GET) como
// AUTORIDADE, criando/listando contas institucionais de treasury sem subject server-side. `tenant_id`
// declarado pelo cliente NÃO é autoridade (DECISION-0113). As 2 rotas foram reduzidas a 501
// INTERNAL_FINANCIAL_AUTHORITY_CONTAINED até existir subject interno autenticado server-side (frente
// própria). Repositório (treasury-account-repository) permanece INTACTO. Zero Bank/Core/payout/worker.

import type { FastifyPluginAsync } from 'fastify';

const CONTAINED = {
  ok: false,
  code: 'INTERNAL_FINANCIAL_AUTHORITY_CONTAINED',
  message:
    'Internal financial HTTP surface contained until server-side internal subject authority exists (no body/query tenant_id authority).',
} as const;

const treasuryAccountController: FastifyPluginAsync = async (app) => {
  // POST /treasury/accounts — CONTIDO (lia tenant_id do body; createTreasuryAccount).
  app.post('/treasury/accounts', async (_req, reply) => reply.status(501).send(CONTAINED));
  // GET /treasury/accounts — CONTIDO (lia tenant_id da query; listTreasuryAccounts).
  app.get('/treasury/accounts', async (_req, reply) => reply.status(501).send(CONTAINED));
};

export default treasuryAccountController;
