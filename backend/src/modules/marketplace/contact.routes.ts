// backend/src/modules/marketplace/contact.routes.ts
// 🔴 R8F CONTACT SCHEMA-GHOST CONTAINMENT — route-level (DECISION-0113 / DECISION-0131 §B7 / Z2 · 2026-06-19):
// A tabela `contacts` é SCHEMA-GHOST — CREATE TABLE só em `migrations_archive/0065_contacts.sql`, ausente do
// schema canônico e de unificard_dev (to_regclass=null). O write JÁ era contido fail-closed no SERVICE
// (`assertContactsFeatureAvailable()` → 501 `CONTACTS_SCHEMA_GHOST_CONTAINED`, guard audit-contacts-schema-ghost-
// containment.mjs). Esta frente eleva a contenção à BORDA (route): as rotas retornam 501 ANTES de ler
// `actionContext.actorId` (canal-1) ou chamar `contactService` — eliminando o canal-1 do arquivo (saída honesta
// do baseline). Comportamento p/ o frontend idêntico (já recebia 501 do service). NÃO religar, NÃO criar
// migration, NÃO materializar `contacts` (gênese é frente própria). Rotas permanecem registradas. O funil do
// service + guard de containment seguem intactos (defesa em profundidade).

import type { FastifyInstance } from 'fastify';

const CONTAINED = {
  error: 'Contacts are temporarily unavailable (schema not materialized).',
  code: 'CONTACTS_SCHEMA_GHOST_CONTAINED',
} as const;

const contactRoutes = async (fastify: FastifyInstance) => {
  // POST /contacts — criar (dead-at-db + canal-1 → contido).
  fastify.post('/contacts', async (_req, reply) => reply.status(501).send(CONTAINED));

  // PATCH /contacts/:id — atualizar (dead-at-db + canal-1 → contido).
  fastify.patch<{ Params: { id: string } }>('/contacts/:id', async (_req, reply) => reply.status(501).send(CONTAINED));

  // GET /contacts — listar (dead-at-db → contido).
  fastify.get('/contacts', async (_req, reply) => reply.status(501).send(CONTAINED));

  // GET /contacts/:id — buscar por id (dead-at-db → contido).
  fastify.get<{ Params: { id: string } }>('/contacts/:id', async (_req, reply) => reply.status(501).send(CONTAINED));

  // GET /contacts/search — buscar (dead-at-db → contido).
  fastify.get('/contacts/search', async (_req, reply) => reply.status(501).send(CONTAINED));

  // POST /contacts/:id/kyc/validate — KYC (dead-at-db → contido).
  fastify.post<{ Params: { id: string } }>('/contacts/:id/kyc/validate', async (_req, reply) => reply.status(501).send(CONTAINED));
};

export default contactRoutes;
