// src/modules/work-instant/status.routes.ts
//
// Rotas para transições de status do Work Instant
//
// 🔴 F-WORK-INSTANT-SCHEMA-GHOST-FAIL-CLOSED-CONTAINMENT (DT-MODULE-WORK-INSTANT-FROZEN-PRE-P4-P5;
// Lote L5 item 2, 2026-07-06). Parte do módulo `work-instant` MONTADO em `/work/instant/*` cujos services
// (instant.repository / worker / assignment) batem em `jobs`/`workers`/`job_assignments` (schema ghost —
// `to_regclass=NULL`, verificado no unificard_dev). Contenção fail-closed HONESTA (501 nomeado, ZERO service,
// ZERO DB) — mesmo padrão dos irmãos deste módulo e de organization/automation. Contenção ≠ remoção:
// repository/tracking/dispatcher preservados.
import { FastifyPluginAsync } from 'fastify';

const WORK_INSTANT_SCHEMA_GHOST_CONTAINED = {
  ok: false,
  code: 'WORK_INSTANT_SCHEMA_GHOST_CONTAINED',
  message:
    'Work Instant (job status transitions) is not available because its canonical schema ' +
    '(jobs / workers / job_assignments) has not been materialized. ' +
    '(DT-MODULE-WORK-INSTANT-FROZEN-PRE-P4-P5)',
};

const statusRoutes: FastifyPluginAsync = async (fastify) => {
  const contained = async (_req: any, reply: any) =>
    reply.status(501).send(WORK_INSTANT_SCHEMA_GHOST_CONTAINED);

  fastify.post('/:requestId/en-route', contained);
  fastify.post('/:requestId/arrived', contained);
  fastify.post('/:requestId/start', contained);
  fastify.post('/:requestId/finish', contained);
};

export default statusRoutes;
