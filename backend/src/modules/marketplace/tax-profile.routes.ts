// backend/src/modules/marketplace/tax-profile.routes.ts
// 🔴 R8E CANAL-1 GHOST WAVE — TAX-PROFILE SCHEMA-GHOST CONTAINMENT (DECISION-0113 / DECISION-0131 §B7 / Z2 · 2026-06-18):
// A tabela `tax_profiles` é SCHEMA-GHOST — CREATE TABLE só em `migrations_archive/0072_tax_profiles.sql`, ausente
// do schema canônico (set de 394 migrations) e de unificard_dev (to_regclass=null). Tax-profile é METADADO FISCAL
// (regime tributário), NÃO movimento de dinheiro. Toda rota era (a) DEAD-AT-DB (INSERT/UPDATE/SELECT numa tabela
// inexistente → 42P01/500) e (b) canal-1/0113 (POST/PATCH liam actionContext.actorId como autoridade). Zero caller
// no frontend. CONTIDAS fail-closed (501 nomeado) ANTES de qualquer service/DB — NÃO religar, NÃO criar migration,
// NÃO redesenhar. Materializar é frente própria. Rotas permanecem registradas.

import type { FastifyInstance } from 'fastify';

const CONTAINED = {
  error: 'Tax profile is temporarily unavailable (schema not materialized).',
  code: 'TAX_PROFILE_SCHEMA_GHOST_CONTAINED',
} as const;

const taxProfileRoutes = async (fastify: FastifyInstance) => {
  fastify.post('/tax-profile', async (_req, reply) => reply.status(501).send(CONTAINED));
  fastify.get('/tax-profile', async (_req, reply) => reply.status(501).send(CONTAINED));
  fastify.patch('/tax-profile', async (_req, reply) => reply.status(501).send(CONTAINED));
};

export default taxProfileRoutes;
