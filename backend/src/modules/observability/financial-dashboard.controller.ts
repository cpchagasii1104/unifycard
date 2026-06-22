// Financial Operations Dashboard — CONTIDO.
//
// 🔴 CONTENÇÃO P1 — F-INTERNAL-FINANCIAL-AUTHORITY-CONTAINMENT (fail-closed, 501).
// Registrado em `/internal` FORA do protectedScope: GET /financial/dashboard lia bank_ledger /
// bank_transactions / financial_audit_trail SEM escopo de tenant (cross-tenant) e sem subject server-side
// — leitura agregada do SSOT de dinheiro de TODOS os tenants por HTTP não autenticado. Reduzido a 501
// INTERNAL_FINANCIAL_AUTHORITY_CONTAINED até existir subject interno autenticado server-side dentro do
// protectedScope (frente própria de observabilidade segura). Monitores subjacentes (ledger-integrity,
// financial-metrics) permanecem INTACTOS. Zero escrita; zero Bank/Core/payout/worker tocado.

import type { FastifyPluginAsync } from 'fastify';

const CONTAINED = {
  ok: false,
  code: 'INTERNAL_FINANCIAL_AUTHORITY_CONTAINED',
  message:
    'Internal financial HTTP surface contained until server-side internal subject authority exists (no cross-tenant read without authenticated subject).',
} as const;

const financialDashboardController: FastifyPluginAsync = async (app) => {
  // GET /financial/dashboard — CONTIDO (lia bank_ledger/transactions/audit cross-tenant sem subject).
  app.get('/financial/dashboard', async (_req, reply) => reply.status(501).send(CONTAINED));
};

export default financialDashboardController;
