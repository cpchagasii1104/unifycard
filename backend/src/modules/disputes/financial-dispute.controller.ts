// Financial Dispute Controller — registro e listagem de disputas.
//
// 🔴 CONTENÇÃO P1 — F-FINANCIAL-INTERNAL-SURFACES-P1-CONTAINMENT (fail-closed).
// Este controller era registrado em `/internal` FORA do protectedScope (app cru, sem authPlugin/
// tenantPlugin/rbacPlugin) e: (a) não tinha req.user/preHandler; (b) lia `tenant_id` do BODY
// (POST/PATCH) e da QUERY (GET) como AUTORIDADE; (c) gravava financial_disputes / financial_alerts
// e listava disputas sem subject server-side seguro, com `listOpenDisputes(undefined)` retornando
// linhas CROSS-TENANT. `tenant_id` declarado pelo cliente NÃO é autoridade (DECISION-0113; tenant
// vem server-side de req.tenant/req.user). As 3 rotas (POST/GET/PATCH /financial/disputes[/:id])
// foram REDUZIDAS ao 403 fail-closed (FINANCIAL_DISPUTES_HTTP_DISABLED): NÃO há mais caminho que
// chame createDispute / listOpenDisputes / updateDisputeStatus / createFinancialAlert por HTTP.
// Os repositórios/funções permanecem intactos para um futuro caller com subject server-side
// dentro do protectedScope (frente própria). Zero Bank: nunca tocou bank_transactions / bank_ledger
// / bank_accounts e segue assim. Ver DT-FINANCIAL-DISPUTES-INTERNAL-HTTP-OPEN.

import type { FastifyPluginAsync } from 'fastify';

const DISABLED = {
  ok: false,
  code: 'FINANCIAL_DISPUTES_HTTP_DISABLED',
  message:
    'Financial dispute mutation/listing through this /internal HTTP route is disabled until a server-side authenticated subject (no body/query tenant_id authority) is implemented.',
} as const;

const financialDisputeController: FastifyPluginAsync = async (app) => {
  // POST /financial/disputes — CONTIDO (lia tenant_id do body e gravava financial_disputes/_alerts).
  app.post('/financial/disputes', async (_req, reply) => reply.status(403).send(DISABLED));

  // GET /financial/disputes — CONTIDO (lia tenant_id da query; listOpenDisputes(undefined) vazava cross-tenant).
  app.get('/financial/disputes', async (_req, reply) => reply.status(403).send(DISABLED));

  // PATCH /financial/disputes/:id — CONTIDO (lia tenant_id do body e mutava status da disputa).
  app.patch('/financial/disputes/:id', async (_req, reply) => reply.status(403).send(DISABLED));
};

export default financialDisputeController;
