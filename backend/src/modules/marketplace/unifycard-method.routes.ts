// backend/src/modules/marketplace/unifycard-method.routes.ts
// 🔴 R8Q UNIFYCARD-METHOD M5 MONEY-AWARE CONTAINMENT (DECISION-0113 / Z2; norma 07_NOMENCLATURA_CANONICA §4.8 · 2026-06-19):
// O trilho unifycard-method (config de adquirência: fees/settlement_days) está MONEY-DEFERRED e SCHEMA-GHOST:
//   • a tabela `unifycard_payment_methods` e o enum `unifycard_method_type` existem só em migrations_archive/0142;
//     no schema vivo to_regclass/to_regtype = NULL → toda rota era dead-at-db (POST/GET → 500).
//   • o POST lia `actionContext.actorId` (canal-1) e o consumo de fee tem defeito de UNIDADE não decidido
//     (unifycard.service: gross*0.0299=299¢ vs payment-execution.service: gross*(0.0299/100)=3¢). A correção
//     canônica é bps INTEGER (_bps, §4.8), mas exige DECISION financeira própria — NÃO é feita aqui.
// CONTENÇÃO money-aware: as 3 rotas retornam 501 `UNIFYCARD_METHOD_MONEY_DEFERRED_CONTAINED` ANTES de qualquer
// service/repository/sink. NÃO corrige fee, NÃO migra bps, NÃO altera settlement/payment-execution/unifycard.service,
// NÃO materializa schema, NÃO toca Bank/ledger. O service (incl. resolveFee, consumido pelo settlement DORMANT/
// proxy-dead em payment-execution.service.ts:321) permanece INTOCADO. Guard: audit-unifycard-method-money-containment.mjs.
// Reabrir exige: schema canônico + DECISION de unidade de fee (bps) + binding de autoridade — frente própria
// (DT-UNIFYCARD-METHOD-FEE-UNIT-BPS-MIGRATION, OPEN).

import type { FastifyInstance } from 'fastify';

const UNIFYCARD_METHOD_GHOST_BODY = {
  ok: false,
  error: 'UNIFYCARD_METHOD_MONEY_DEFERRED_CONTAINED',
  code: 'UNIFYCARD_METHOD_MONEY_DEFERRED_CONTAINED',
  message:
    'UnifyCard acquiring-method configuration is disabled: its schema is ghost (unifycard_payment_methods/' +
    'unifycard_method_type do not exist in the canonical schema) and its fee unit is an undecided money matter ' +
    '(canonical = basis points / _bps INTEGER per 07_NOMENCLATURA_CANONICA §4.8). Reopening requires a canonical ' +
    'schema + a fee-unit decision + server-side authority binding. No money is moved.',
} as const;

const unifyCardMethodRoutes = async (fastify: FastifyInstance) => {
  fastify.post('/unifycard/methods', async (_req, reply) => reply.status(501).send(UNIFYCARD_METHOD_GHOST_BODY));
  fastify.get('/unifycard/methods', async (_req, reply) => reply.status(501).send(UNIFYCARD_METHOD_GHOST_BODY));
  fastify.get<{ Params: { type: string } }>('/unifycard/methods/:type', async (_req, reply) => reply.status(501).send(UNIFYCARD_METHOD_GHOST_BODY));
};

export default unifyCardMethodRoutes;
