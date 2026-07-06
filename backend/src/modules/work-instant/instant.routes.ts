// src/modules/work-instant/instant.routes.ts
//
// Rotas para Work Instant (matching em tempo real)
//
// 🔴 F-WORK-INSTANT-SCHEMA-GHOST-FAIL-CLOSED-CONTAINMENT (DT-MODULE-WORK-INSTANT-FROZEN-PRE-P4-P5;
// Lote L5 item 2, 2026-07-06). O módulo `work-instant` está MONTADO e alcançável em `/work/instant/*`
// (work.module.ts → app.builder.ts) e os services batem em `jobs`/`workers`/`worker_skills`/
// `job_assignments` — tabelas que **não são criadas por NENHUMA migration canônica** (`to_regclass=NULL`
// para as quatro, verificado no unificard_dev). → schema ghost: qualquer acesso emitiria `42P01 relation
// does not exist` (500 cru). As decisões P4/P5 (matching real) seguem pendentes; `actor_delegations` tem 9
// rows mas todas revogadas (0 ativas) — pré-condição de descongelamento não cumprida.
//
// Decisão (2026-07-06, GO de Clayton "siga o fluxo de correções respeitando leis e normas"): substituir o
// 500 cru por contenção fail-closed HONESTA: 501 nomeado, ZERO chamada a service, ZERO acesso ao DB.
// Contenção ≠ remoção: service/types preservados. Mesmo padrão de organization/automation/saúde.
import { FastifyPluginAsync } from 'fastify';

const WORK_INSTANT_SCHEMA_GHOST_CONTAINED = {
  ok: false,
  code: 'WORK_INSTANT_SCHEMA_GHOST_CONTAINED',
  message:
    'Work Instant (real-time matching) is not available because its canonical schema ' +
    '(jobs / workers / worker_skills / job_assignments) has not been materialized. ' +
    '(DT-MODULE-WORK-INSTANT-FROZEN-PRE-P4-P5)',
};

const instantRoutes: FastifyPluginAsync = async (fastify) => {
  const contained = async (_req: any, reply: any) =>
    reply.status(501).send(WORK_INSTANT_SCHEMA_GHOST_CONTAINED);

  fastify.post('/request', contained);
  fastify.get('/:requestId', contained);
  fastify.post('/:requestId/accept', contained);
  fastify.post('/:requestId/cancel', contained);
};

export default instantRoutes;
