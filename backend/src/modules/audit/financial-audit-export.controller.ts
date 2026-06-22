// Financial Audit Exporter — CONTIDO.
//
// 🔴 CONTENÇÃO P1 — F-INTERNAL-FINANCIAL-AUTHORITY-CONTAINMENT (fail-closed, 501).
// Registrado em `/internal` FORA do protectedScope: GET /financial/audit/export lia `tenant_id` da QUERY
// como filtro OPCIONAL — sem tenant, exportava bank_transactions / bank_ledger / payout_requests /
// bank_settlements de TODOS os tenants (vazamento cross-tenant do SSOT de dinheiro), sem subject
// server-side. `tenant_id` declarado pelo cliente NÃO é autoridade (DECISION-0113). A rota foi reduzida a
// 501 INTERNAL_FINANCIAL_AUTHORITY_CONTAINED até existir subject interno autenticado server-side (frente
// própria). Nenhum SELECT em bank_* por HTTP até lá. Zero escrita; zero Bank/Core/payout/worker tocado.

import type { FastifyPluginAsync } from 'fastify';

const CONTAINED = {
  ok: false,
  code: 'INTERNAL_FINANCIAL_AUTHORITY_CONTAINED',
  message:
    'Internal financial HTTP surface contained until server-side internal subject authority exists (no body/query tenant_id authority).',
} as const;

const financialAuditExportController: FastifyPluginAsync = async (app) => {
  // GET /financial/audit/export — CONTIDO (sem tenant na query vazava bank_* de todos os tenants).
  app.get('/financial/audit/export', async (_req, reply) => reply.status(501).send(CONTAINED));
};

export default financialAuditExportController;
