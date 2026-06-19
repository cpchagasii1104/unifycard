// backend/src/modules/marketplace/accounts-receivable.routes.ts
// 🔴 R8H ACCOUNTS-RECEIVABLE REACTIVATION-TRAP CONTAINMENT (DECISION-0113 / DECISION-0131 §B7 / Z2; DECISION-0114 D5 · 2026-06-19):
// AR foi MIGRADO para o Bank: o service usa um Proxy reject-all ("AccountsReceivable migrated to Bank") e a tabela
// `accounts_receivable` é SCHEMA-GHOST (to_regclass=null em unificard_dev). As rotas públicas liam
// `actionContext.actorId`/`query.actorId` (canal-1/0113) SEM canRepresentActor e, numa reativação futura do repo,
// escreveriam receivable com autoridade não-vinculada (reactivation trap). DECISION-0114 D5 PROÍBE religar AP/AR
// sem decisão própria. CONTENÇÃO DEFENSIVA fail-closed: as rotas retornam **403 `ACCOUNTS_RECEIVABLE_DISABLED`**
// ANTES de ler actionContext OU chamar o service. NÃO religa AR, NÃO troca o Proxy, NÃO toca Bank/ledger, NÃO cria
// migration. O service (Proxy reject-all) e os callers internos (payment-execution/ticket) permanecem INALTERADOS
// (já reject). A leitura do CRM (crm.service.ts:413 FROM accounts_receivable, ghost dead-at-db) é RESIDUAL — não
// é writer canal-1 e não é redesenhada aqui. Guard: audit-ap-ar-reactivation-trap.mjs.

import type { FastifyInstance } from 'fastify';

const DISABLED = {
  ok: false,
  code: 'ACCOUNTS_RECEIVABLE_DISABLED',
  error: 'Accounts Receivable is disabled (migrated to Bank). Reactivation requires its own front (DECISION-0114 D5) with canonical authority binding.',
} as const;

const accountsReceivableRoutes = async (fastify: FastifyInstance) => {
  fastify.post('/accounts-receivable/manual', async (_req, reply) => reply.status(403).send(DISABLED));
  fastify.get('/accounts-receivable', async (_req, reply) => reply.status(403).send(DISABLED));
  fastify.get<{ Params: { id: string } }>('/accounts-receivable/:id', async (_req, reply) => reply.status(403).send(DISABLED));
  fastify.post<{ Params: { id: string } }>('/accounts-receivable/:id/mark-received', async (_req, reply) => reply.status(403).send(DISABLED));
  fastify.post<{ Params: { id: string } }>('/accounts-receivable/:id/cancel', async (_req, reply) => reply.status(403).send(DISABLED));
};

export default accountsReceivableRoutes;
