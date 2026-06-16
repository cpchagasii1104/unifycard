// backend/src/modules/organization/organization.routes.ts
// SPRINT 78: Rotas REST para Organization

import type { FastifyInstance } from 'fastify';

// 🔴 F-ORGANIZATION-SCHEMA-GHOST-FAIL-CLOSED-CONTAINMENT (DT-ORGANIZATION-SCHEMA-GHOST):
// O módulo `organization` está MONTADO (app.builder.ts, prefixo /organization) e suas rotas batem nos
// services/repositories de `organization_invites`/`organization_members`/`organization_units`/
// `organization_roles`. Mas essas tabelas **não são criadas por NENHUMA migration canônica** (verificado:
// zero `CREATE TABLE ... organization_*` em backend/migrations; `to_regclass=NULL` p/ as 4). →schema ghost.
// `organization_members` é, ademais, **tombstone conhecido** (DECISION-0131 / WAVE1-BATCH1 F2: "tombstones
// não ressuscitam"; ausente no schema vivo). Qualquer acesso ao DB emitiria `42P01 relation does not exist`
// (500 cru). O binding DECISION-0113 (`requireRepresentable`) que existia aqui era correto em intenção, mas
// roda sobre superfície MORTA — não há caminho vivo seguro. NÃO se faz binding sobre rota ghost.
//
// Decisão IA Diretora (2026-06-16): NÃO religar / NÃO materializar schema / NÃO ressuscitar
// organization_members / NÃO ativar feature. Substituir o 500 cru por contenção fail-closed HONESTA
// (blanket): 501 nomeado, ZERO chamada ao service/repository, ZERO acesso ao DB, ZERO write, ZERO autoria —
// em TODAS as rotas (reads e writes batem nas mesmas tabelas ghost). Materialização/religação/descontinuação
// = decisão Clayton (DT-ORGANIZATION-SCHEMA-GHOST / DT-ORGANIZATION-AUTHORITY-BINDING-LATENT).
const ORGANIZATION_SCHEMA_GHOST_CONTAINED = {
  ok: false,
  code: 'ORGANIZATION_SCHEMA_GHOST_CONTAINED',
  message:
    'Organization module is not available because its canonical schema (organization_invites / ' +
    'organization_members / organization_units / organization_roles) has not been materialized. ' +
    '(DT-ORGANIZATION-SCHEMA-GHOST)',
};

const organizationRoutes = async (fastify: FastifyInstance) => {
  // Handler de contenção único — curto-circuito fail-closed (501) ANTES de qualquer service/repository/DB.
  const contained = async (_req: any, reply: any) =>
    reply.status(501).send(ORGANIZATION_SCHEMA_GHOST_CONTAINED);

  // ── INVITES (writes contidos + read contido) ──
  fastify.post('/invites', contained);
  fastify.post('/invites/:id/accept', contained);
  fastify.post('/invites/:id/revoke', contained);
  fastify.get('/invites', contained);

  // ── MEMBERS (read + writes contidos) — organization_members é tombstone; NÃO ressuscitado ──
  fastify.get('/members', contained);
  fastify.post('/members/:id/role', contained);
  fastify.post('/members/:id/remove', contained);

  // ── ORGANIZATION UNITS (reads contidos — batem nas mesmas tabelas ghost) ──
  fastify.get('/units', contained);
  fastify.get('/units/tree', contained);
  fastify.get('/units/:id', contained);
  fastify.get('/units/:id/children', contained);
  fastify.get('/units/:id/descendants', contained);
  fastify.get('/units/actor/:actorId', contained);
};

export default organizationRoutes;
