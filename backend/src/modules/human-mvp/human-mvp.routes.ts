// backend/src/modules/human-mvp/human-mvp.routes.ts
// 🔴 R8N HUMAN-MVP SCHEMA-GHOST CONTAINMENT (DECISION-0113 / Z2 · 2026-06-19):
// Todo o substrato do Human-MVP (protótipo skill/service-offer/opportunity/event-instance/activity-execution) é
// SCHEMA-GHOST: as tabelas human_mvp_skills/service_offers/opportunities/event_instances/activity_executions +
// skills/service_offers/opportunities NÃO existem (to_regclass=null em unificard_dev) — toda rota era dead-at-db.
// Este módulo NÃO é a vertical G10 VIVA (sem frontend caller; tabelas ausentes; registrado sob /n como protótipo).
// O canal-1 vivia em POST /skills (actionContext.actorId → resolve actor → globalUserId). CONTENÇÃO fail-closed: as
// 5 rotas retornam 501 `HUMAN_MVP_SCHEMA_GHOST_CONTAINED` antes de qualquer service/sink. NÃO toca Bank/ledger, NÃO
// cria migration, NÃO materializa schema, NÃO decide produto G10. Os services permanecem INTOCADOS (dead). Reabrir
// como produto vivo exige schema canônico + decisão de produto (G10) + binding de autoridade server-side.

import { FastifyPluginAsync } from 'fastify';

const HUMAN_MVP_GHOST_BODY = {
  ok: false,
  code: 'HUMAN_MVP_SCHEMA_GHOST_CONTAINED',
  error: 'HUMAN_MVP_SCHEMA_GHOST_CONTAINED',
  message:
    'Human-MVP (skills/service-offers/opportunities/event-instances/activity-executions) is disabled: its schema is ' +
    'ghost (none of the human_mvp_* tables exist in the canonical schema). Reopening as a live product requires a ' +
    'canonical schema + a product decision (G10) + server-side authority binding. No money is moved.',
} as const;

const humanMvpRoutes: FastifyPluginAsync = async (fastify) => {
  // Todas as superfícies do Human-MVP são schema-ghost (dead-at-db) → 501 antes de qualquer service/sink.
  fastify.post('/skills', async (_req, reply) => reply.status(501).send(HUMAN_MVP_GHOST_BODY));
  fastify.post('/service-offers', async (_req, reply) => reply.status(501).send(HUMAN_MVP_GHOST_BODY));
  fastify.post('/opportunities', async (_req, reply) => reply.status(501).send(HUMAN_MVP_GHOST_BODY));
  fastify.post('/event-instances', async (_req, reply) => reply.status(501).send(HUMAN_MVP_GHOST_BODY));
  fastify.post('/activity-executions', async (_req, reply) => reply.status(501).send(HUMAN_MVP_GHOST_BODY));
};

export default humanMvpRoutes;
