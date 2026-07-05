// backend/src/core/unifybank/regional-fund-governance.routes.ts
// Rotas de Governança do Fundo Regional - FASE 8
//
// 🔴 F-REGIONAL-FUND-GOVERNANCE-SCHEMA-GHOST-FAIL-CLOSED-CONTAINMENT (achado colateral da Fatia 9
// passo 3, DT-REGIONAL-FUND-GOVERNANCE-LIVE-SCHEMA-GHOST): esta rota estava VIVA e registrada,
// exigindo só `req.user`, alcançando `regionalFundGovernanceService` → INSERT/SELECT em
// `regional_fund_proposals`/`regional_fund_votes`, tabelas que NÃO EXISTEM no schema vivo
// (`to_regclass` = NULL) → 42P01 / 500 cru pra qualquer autenticado. Contida na BORDA (mesmo
// padrão de contact.routes.ts): cada rota devolve 501 CONTAINED direto, nunca lê
// actionContext/req.user pra decidir lógica, nunca chama regionalFundGovernanceService. A LÓGICA
// (regional-fund-governance.service.ts) NÃO foi tocada — religa sozinha quando o schema nascer
// (frente própria F-REGIONAL-FUND-GOVERNANCE-SCHEMA-GENESIS; guard de probe em
// regional-fund-governance-feature.guard.ts).

import { FastifyPluginAsync } from 'fastify';
import { REGIONAL_FUND_GOVERNANCE_SCHEMA_GHOST_CODE } from './regional-fund-governance-feature.guard';

const CONTAINED = {
  error: 'REGIONAL_FUND_GOVERNANCE_SCHEMA_GHOST_CONTAINED: a feature de Governança do Fundo Regional não está disponível (tabelas regional_fund_proposals/regional_fund_votes ausentes no schema vivo). Gênese é frente própria.',
  code: REGIONAL_FUND_GOVERNANCE_SCHEMA_GHOST_CODE,
};

const governanceRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/proposals', async (_req, reply) => reply.status(501).send(CONTAINED));
  fastify.get('/proposals', async (_req, reply) => reply.status(501).send(CONTAINED));
  fastify.get<{ Params: { proposalId: string } }>('/proposals/:proposalId', async (_req, reply) => reply.status(501).send(CONTAINED));
  fastify.post<{ Params: { proposalId: string } }>('/proposals/:proposalId/vote', async (_req, reply) => reply.status(501).send(CONTAINED));
  fastify.post<{ Params: { proposalId: string } }>('/proposals/:proposalId/open', async (_req, reply) => reply.status(501).send(CONTAINED));
  fastify.post<{ Params: { proposalId: string } }>('/proposals/:proposalId/close', async (_req, reply) => reply.status(501).send(CONTAINED));
  fastify.post<{ Params: { proposalId: string } }>('/proposals/:proposalId/execute', async (_req, reply) => reply.status(501).send(CONTAINED));
};

export default governanceRoutes;
