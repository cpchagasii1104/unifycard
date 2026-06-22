// Financial Operations Panel — CONTIDO.
//
// 🔴 CONTENÇÃO P1 — F-INTERNAL-FINANCIAL-AUTHORITY-CONTAINMENT (fail-closed, 501).
// Registrado em `/internal` FORA do protectedScope: GET /financial/{transactions,ledger,audit,metrics,health}
// liam bank_transactions / bank_ledger / financial_audit_trail SEM escopo de tenant (cross-tenant) e sem
// subject server-side — leitura do SSOT de dinheiro de TODOS os tenants por HTTP não autenticado. Reduzido
// a 501 INTERNAL_FINANCIAL_AUTHORITY_CONTAINED até existir subject interno autenticado server-side dentro do
// protectedScope (frente própria de observabilidade segura). Monitores subjacentes (financial-metrics,
// financial-health) permanecem INTACTOS. Zero escrita; zero Bank/Core/payout/worker tocado.

import type { FastifyPluginAsync } from 'fastify';

const CONTAINED = {
  ok: false,
  code: 'INTERNAL_FINANCIAL_AUTHORITY_CONTAINED',
  message:
    'Internal financial HTTP surface contained until server-side internal subject authority exists (no cross-tenant read without authenticated subject).',
} as const;

const financialOperationsPanelController: FastifyPluginAsync = async (app) => {
  // Todas CONTIDAS — liam SSOT de dinheiro cross-tenant sem subject server-side.
  app.get('/financial/transactions', async (_req, reply) => reply.status(501).send(CONTAINED));
  app.get('/financial/ledger', async (_req, reply) => reply.status(501).send(CONTAINED));
  app.get('/financial/audit', async (_req, reply) => reply.status(501).send(CONTAINED));
  app.get('/financial/metrics', async (_req, reply) => reply.status(501).send(CONTAINED));
  app.get('/financial/health', async (_req, reply) => reply.status(501).send(CONTAINED));
};

export default financialOperationsPanelController;
