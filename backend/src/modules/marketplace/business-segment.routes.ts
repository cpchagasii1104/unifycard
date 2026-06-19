// backend/src/modules/marketplace/business-segment.routes.ts
// 🔴 R8E CANAL-1 GHOST WAVE — BUSINESS-SEGMENT SCHEMA-GHOST CONTAINMENT (DECISION-0113 / DECISION-0131 §B7 / Z2 · 2026-06-18):
// A tabela `business_segments` é SCHEMA-GHOST — CREATE TABLE só em `migrations_archive/0048_business_segments.sql`,
// ausente do schema canônico (set de 394 migrations) e de unificard_dev (to_regclass=null). Toda rota era
// (a) DEAD-AT-DB (INSERT/UPDATE/SELECT numa tabela inexistente → 42P01/500) e (b) canal-1/0113 (POST/PATCH liam
// actionContext.actorId como autoridade). Zero caller no frontend. CONTIDAS fail-closed (501 nomeado) ANTES de
// qualquer service/DB — NÃO religar, NÃO criar migration, NÃO redesenhar. Materializar é frente própria. Rotas
// permanecem registradas.

import type { FastifyInstance } from 'fastify';

const CONTAINED = {
  error: 'Business segment is temporarily unavailable (schema not materialized).',
  code: 'BUSINESS_SEGMENT_SCHEMA_GHOST_CONTAINED',
} as const;

const businessSegmentRoutes = async (fastify: FastifyInstance) => {
  fastify.post('/business-segment', async (_req, reply) => reply.status(501).send(CONTAINED));
  fastify.get('/business-segment', async (_req, reply) => reply.status(501).send(CONTAINED));
  fastify.patch('/business-segment', async (_req, reply) => reply.status(501).send(CONTAINED));
};

export default businessSegmentRoutes;
