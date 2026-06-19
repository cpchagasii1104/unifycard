// backend/src/modules/social/social-marketplace-ref.routes.ts
// 🔴 R8D SOCIAL-MARKETPLACE-REF SCHEMA-GHOST CONTAINMENT (DECISION-0113 / DECISION-0131 §B7 / Z2 · 2026-06-18):
// A tabela `social_marketplace_refs` é SCHEMA-GHOST — o CREATE TABLE existe SÓ em
// `migrations_archive/0759_social_marketplace_refs.sql` e NÃO está no schema canônico (set de 394 migrations) nem
// em unificard_dev (to_regclass('public.social_marketplace_refs') = null). Toda rota deste módulo era
// (a) DEAD-AT-DB — o repository faz INSERT(UPSERT)/SELECT/DELETE numa tabela inexistente → 42P01/500; e
// (b) canal-1/0113 — a rota lia `actionContext.actorId` (apenas para auditoria non-blocking; o write `createRef`
// NUNCA recebia o actor — breadcrumb puro). Como o substrato não existe, a correção honesta é CONTER fail-closed
// (501 nomeado) ANTES de qualquer service/DB — NÃO religar, NÃO criar migration, NÃO redesenhar marketplace.
// Materializar o schema + binding canônico (se a feature for revivida) é frente própria, fora do escopo R8D.
// As rotas permanecem registradas (não removidas).

import type { FastifyInstance } from 'fastify';

const CONTAINED = {
  error: 'Social marketplace references are temporarily unavailable (schema not materialized).',
  code: 'SOCIAL_MARKETPLACE_REF_SCHEMA_GHOST_CONTAINED',
} as const;

const socialMarketplaceRefRoutes = async (fastify: FastifyInstance) => {
  // POST /social/marketplace-ref — criar referência (dead-at-db + canal-1 breadcrumb → contido).
  fastify.post('/marketplace-ref', async (_req, reply) => reply.status(501).send(CONTAINED));

  // GET /social/marketplace-ref/:postId — listar por post (dead-at-db → contido).
  fastify.get<{ Params: { postId: string } }>(
    '/marketplace-ref/:postId',
    async (_req, reply) => reply.status(501).send(CONTAINED)
  );

  // GET /social/marketplace-ref/details/:refId — detalhes (dead-at-db → contido).
  fastify.get<{ Params: { refId: string } }>(
    '/marketplace-ref/details/:refId',
    async (_req, reply) => reply.status(501).send(CONTAINED)
  );
};

export default socialMarketplaceRefRoutes;
