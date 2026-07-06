// src/modules/work-instant/worker-status.routes.ts
//
// Rotas para gerenciar status online/offline e localização de workers
//
// 🔴 F-WORK-INSTANT-SCHEMA-GHOST-FAIL-CLOSED-CONTAINMENT (DT-MODULE-WORK-INSTANT-FROZEN-PRE-P4-P5;
// Lote L5 item 2, 2026-07-06). Parte do módulo `work-instant` MONTADO em `/work/instant/*` cujos services
// batem em `workers`/`worker_skills` (schema ghost — `to_regclass=NULL`, verificado no unificard_dev).
// Contenção fail-closed HONESTA (501 nomeado, ZERO service, ZERO DB) — mesmo padrão dos irmãos deste módulo
// e de organization/automation. Contenção ≠ remoção: worker-status.service preservado.
import { FastifyPluginAsync } from 'fastify';

const WORK_INSTANT_SCHEMA_GHOST_CONTAINED = {
  ok: false,
  code: 'WORK_INSTANT_SCHEMA_GHOST_CONTAINED',
  message:
    'Work Instant (worker status/location) is not available because its canonical schema ' +
    '(workers / worker_skills) has not been materialized. ' +
    '(DT-MODULE-WORK-INSTANT-FROZEN-PRE-P4-P5)',
};

const workerStatusRoutes: FastifyPluginAsync = async (fastify) => {
  const contained = async (_req: any, reply: any) =>
    reply.status(501).send(WORK_INSTANT_SCHEMA_GHOST_CONTAINED);

  fastify.post('/online', contained);
  fastify.post('/offline', contained);
  fastify.post('/location', contained);
  fastify.get('/presence/:userId', contained);
};

export default workerStatusRoutes;
