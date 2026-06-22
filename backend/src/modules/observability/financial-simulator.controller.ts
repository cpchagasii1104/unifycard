// Simulador Financeiro Interno — CONTIDO.
//
// 🔴 CONTENÇÃO P1 — F-INTERNAL-FINANCIAL-AUTHORITY-CONTAINMENT (fail-closed, 501).
// Registrado em `/internal` FORA do protectedScope: POST /financial/simulate-payment CRIAVA tenant/users/
// companies e executava uma cadeia bancária completa (deposit→escrow→settlement→release→payout→bank
// settlement) escrevendo em bank_ledger/bank_transactions por HTTP, sem subject server-side (só tinha
// guard de NODE_ENV=production). Superfície de escrita financeira por HTTP não autenticado. Reduzido a 501
// INTERNAL_FINANCIAL_AUTHORITY_CONTAINED até existir subject interno autenticado server-side (frente
// própria). Os serviços de banco (bankTransactionService/paymentExecutionService/bankAccountService)
// permanecem INTACTOS — a simulação, se necessária, roda por script/test, não por HTTP. Zero payout/worker/PORTA-1 tocado.

import type { FastifyPluginAsync } from 'fastify';

const CONTAINED = {
  ok: false,
  code: 'INTERNAL_FINANCIAL_AUTHORITY_CONTAINED',
  message:
    'Internal financial HTTP surface contained until server-side internal subject authority exists (financial simulation via HTTP disabled).',
} as const;

const financialSimulatorController: FastifyPluginAsync = async (app) => {
  // POST /financial/simulate-payment — CONTIDO (criava tenant/users/companies + cadeia bancária por HTTP).
  app.post('/financial/simulate-payment', async (_req, reply) => reply.status(501).send(CONTAINED));
};

export default financialSimulatorController;
