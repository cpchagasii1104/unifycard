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
import { containModule } from '@core/product-scope/out-of-scope-containment';

const HUMAN_MVP_GHOST_BODY = {
  ok: false,
  code: 'HUMAN_MVP_SCHEMA_GHOST_CONTAINED',
  error: 'HUMAN_MVP_SCHEMA_GHOST_CONTAINED',
  message:
    'Human-MVP (skills/service-offers/opportunities/event-instances/activity-executions) is disabled: its schema is ' +
    'ghost (none of the human_mvp_* tables exist in the canonical schema). Reopening as a live product requires a ' +
    'canonical schema + a product decision (G10) + server-side authority binding. No money is moved.',
} as const;

// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CONTIDO — fora do mínimo de produto (F-OUT-OF-SCOPE-CONTAINMENT, 2026-08-01)
// ║ NORMA:   decisão de produto de Clayton, 2026-08-01 (cartório REMEDIATION_DT_LOG.md, topo)
// ║ NÃO:     religar materializando tabela na mão. 5 endpoints, montado em /human-mvp (app.builder.ts:572);
// ║          substrato medido AUSENTE em unificard_dev: human_mvp_events, human_mvp_event_instances, human_mvp_opportunities, human_mvp_service_offers.
// ║          NÃO é dívida técnica quebrada — é ESCOPO NÃO INICIADO. NÃO apagar arquivo/rota.
// ║ EM VEZ:  UMA linha (o addHook abaixo) contém o módulo na borda, ANTES de qualquer
// ║          service/SQL. Religar = apagar a linha + materializar do archive com GATE.
// ╚════════════════════════════════════════════════════════════════
const humanMvpRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', containModule({
    module: 'human-mvp',
    reason: 'out_of_product_minimum',
    missingSubstrate: ['human_mvp_events', 'human_mvp_event_instances', 'human_mvp_opportunities', 'human_mvp_service_offers'],
  }));

  // Todas as superfícies do Human-MVP são schema-ghost (dead-at-db) → 501 antes de qualquer service/sink.
  fastify.post('/skills', async (_req, reply) => reply.status(501).send(HUMAN_MVP_GHOST_BODY));
  fastify.post('/service-offers', async (_req, reply) => reply.status(501).send(HUMAN_MVP_GHOST_BODY));
  fastify.post('/opportunities', async (_req, reply) => reply.status(501).send(HUMAN_MVP_GHOST_BODY));
  fastify.post('/event-instances', async (_req, reply) => reply.status(501).send(HUMAN_MVP_GHOST_BODY));
  fastify.post('/activity-executions', async (_req, reply) => reply.status(501).send(HUMAN_MVP_GHOST_BODY));
};

export default humanMvpRoutes;
