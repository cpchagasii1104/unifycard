// backend/src/modules/escrow/escrow.routes.ts
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  APOSENTADO — F-ESCROW-RETIREMENT fatia 4, a última (2026-08-02, GO Clayton)
// ║ NORMA:   SSOT_EXCLUSIVE_BANK_RULE + CLAUDE.md §3.2 ① — o Bank é a ÚNICA verdade sobre
// ║          custódia. A frente inteira: f1 torneira fechada (service-order, 8ª superfície do
// ║          guard) · f2 zero leitores fora do módulo (reporting lê a conta canônica do Bank) ·
// ║          f3 a ilha de UI caiu com a INTENÇÃO registrada como herança (cartório) · f4 esta.
// ║ NÃO:     religar estas rotas ao service. As 11 superfícies respondem 501 nomeado; o guard
// ║          contained-route-antireopen (9ª entrada) morde se um símbolo de service reaparecer
// ║          sem a contenção. NÃO materializar nada para "fazer funcionar".
// ║ EM VEZ:  a tela e a API de custódia REAIS nascem com a PORTA-01, sobre a conta canônica do
// ║          Bank — começando pela entrada de HERANÇA no cartório (marcos com percentuais ·
// ║          authorize/release separados · disputa bloqueia · READY_TO_RELEASE é DERIVADO,
// ║          nunca persistido).
// ╚════════════════════════════════════════════════════════════════
//
// Os paths originais são preservados de propósito: quem os chamar recebe a explicação, não um
// 404 mudo. service/repository do módulo seguem no disco como dormentes cercados.

import type { FastifyInstance } from 'fastify';

const RETIRED_BODY = {
  ok: false,
  code: 'SECOND_LEDGER_RETIRED',
  error: 'SECOND_LEDGER_RETIRED',
  message:
    'The escrow surface is retired. Custody truth lives in the Bank (escrow_payments account); ' +
    'the milestone-based custody UX arrives with PORTA-01, inheriting the recorded design intent. ' +
    'No money is moved. See REMEDIATION_DT_LOG.md (F-ESCROW-RETIREMENT).',
  money_moved: false,
} as const;

const RETIRED_PATHS_GET = [
  '/escrow',
  '/escrow/:escrowId',
  '/escrow/:escrowId/financial-position',
  '/escrow/agreement/:agreementId',
  '/escrow/:escrowId/milestones',
  '/escrow/:escrowId/transactions',
] as const;

const RETIRED_PATHS_POST = [
  '/escrow',
  '/escrow/:escrowId/authorize-milestone',
  '/escrow/:escrowId/release-payment',
  '/escrow/:escrowId/refund',
  '/escrow/:escrowId/sync-dispute-status',
] as const;

const escrowRoutes = async (fastify: FastifyInstance) => {
  for (const path of RETIRED_PATHS_GET) {
    fastify.get(path, async (_req, reply) => reply.status(501).send(RETIRED_BODY));
  }
  for (const path of RETIRED_PATHS_POST) {
    fastify.post(path, async (_req, reply) => reply.status(501).send(RETIRED_BODY));
  }
};

export default escrowRoutes;
