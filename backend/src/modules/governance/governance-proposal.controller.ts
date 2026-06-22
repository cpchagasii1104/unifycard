// Governance Proposal Controller — CONTIDO.
//
// 🔴 CONTENÇÃO P1 — F-INTERNAL-FINANCIAL-AUTHORITY-CONTAINMENT (fail-closed, 501).
// Registrado em `/internal` FORA do protectedScope: lia `tenant_id` do BODY (POST proposal/vote) e da
// QUERY (GET) como AUTORIDADE, gravando/lendo governance_proposals sem subject server-side. `tenant_id`
// declarado pelo cliente NÃO é autoridade (DECISION-0113). As 3 rotas foram reduzidas a 501
// INTERNAL_FINANCIAL_AUTHORITY_CONTAINED até existir subject interno autenticado server-side (frente
// própria). Repositório (governance-proposal-repository) permanece INTACTO. Zero Bank/Core/payout/worker.

import type { FastifyPluginAsync } from 'fastify';

const CONTAINED = {
  ok: false,
  code: 'INTERNAL_FINANCIAL_AUTHORITY_CONTAINED',
  message:
    'Internal financial HTTP surface contained until server-side internal subject authority exists (no body/query tenant_id authority).',
} as const;

const governanceProposalController: FastifyPluginAsync = async (app) => {
  // POST /governance/proposals — CONTIDO (lia tenant_id do body; createProposal).
  app.post('/governance/proposals', async (_req, reply) => reply.status(501).send(CONTAINED));
  // POST /governance/proposals/:id/vote — CONTIDO (lia tenant_id do body; voteProposal).
  app.post('/governance/proposals/:id/vote', async (_req, reply) => reply.status(501).send(CONTAINED));
  // GET /governance/proposals — CONTIDO (lia tenant_id da query; listOpenProposals).
  app.get('/governance/proposals', async (_req, reply) => reply.status(501).send(CONTAINED));
};

export default governanceProposalController;
