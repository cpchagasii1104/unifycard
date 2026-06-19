// backend/src/modules/marketplace/accounts-payable.routes.ts
// 🔴 R8H ACCOUNTS-PAYABLE REACTIVATION-TRAP CONTAINMENT (DECISION-0113 / DECISION-0131 §B7 / Z2; DECISION-0114 D5 · 2026-06-19):
// AP foi MIGRADO para o Bank: o service usa um Proxy reject-all ("AccountsPayable migrated to Bank") e a tabela
// `accounts_payable` é SCHEMA-GHOST (to_regclass=null em unificard_dev). As rotas públicas liam
// `actionContext.actorId` (canal-1/0113) SEM canRepresentActor e, numa reativação futura do repo, escreveriam
// payable com autoridade não-vinculada (reactivation trap). DECISION-0114 D5 PROÍBE religar AP/AR sem decisão
// própria. CONTENÇÃO DEFENSIVA fail-closed: as rotas retornam **403 `ACCOUNTS_PAYABLE_DISABLED`** ANTES de ler
// actionContext OU chamar o service — eliminando o canal-1 do arquivo e bloqueando reativação silenciosa via HTTP.
// NÃO religa AP, NÃO troca o Proxy, NÃO toca Bank/ledger/scheduled-action, NÃO cria migration. O service (Proxy
// reject-all) e os callers internos (purchase-order/scheduled-action) permanecem INALTERADOS (já reject). Guard:
// audit-ap-ar-reactivation-trap.mjs. Religação só via frente própria (DECISION-0114 D5) com binding canônico.

import type { FastifyInstance } from 'fastify';

const DISABLED = {
  ok: false,
  code: 'ACCOUNTS_PAYABLE_DISABLED',
  error: 'Accounts Payable is disabled (migrated to Bank). Reactivation requires its own front (DECISION-0114 D5) with canonical authority binding.',
} as const;

const accountsPayableRoutes = async (fastify: FastifyInstance) => {
  fastify.post('/accounts-payable/from-purchase-order', async (_req, reply) => reply.status(403).send(DISABLED));
  fastify.post('/accounts-payable/manual', async (_req, reply) => reply.status(403).send(DISABLED));
  fastify.get('/accounts-payable', async (_req, reply) => reply.status(403).send(DISABLED));
  fastify.get<{ Params: { id: string } }>('/accounts-payable/:id', async (_req, reply) => reply.status(403).send(DISABLED));
  fastify.post<{ Params: { id: string } }>('/accounts-payable/:id/schedule', async (_req, reply) => reply.status(403).send(DISABLED));
  fastify.post<{ Params: { id: string } }>('/accounts-payable/:id/mark-paid', async (_req, reply) => reply.status(403).send(DISABLED));
  fastify.post<{ Params: { id: string } }>('/accounts-payable/:id/cancel', async (_req, reply) => reply.status(403).send(DISABLED));
};

export default accountsPayableRoutes;
