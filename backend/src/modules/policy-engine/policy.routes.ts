// backend/src/modules/policy-engine/policy.routes.ts
//
// 🔴 F-POLICY-ENGINE-SCHEMA-GHOST-FAIL-CLOSED-CONTAINMENT (DT-MODULE-POLICY-ENGINE-AUDIT-URGENTE;
// Lote L5 item 5, 2026-07-06). O módulo `policy-engine` está MONTADO (app.builder.ts:600, dentro do
// protectedScope) e o service bate em `policy_rules`/`policy_decisions` — tabelas que **não são criadas por
// NENHUMA migration canônica** (`to_regclass=NULL` para ambas, verificado no unificard_dev). → schema ghost:
// qualquer acesso emitiria `42P01 relation does not exist` (500 cru). O ecossistema pré-requisito de risco
// (`actor_risk_profile`/`trust_profiles`/`trust_score_snapshots` = 0 rows; `evidence_packs`/
// `business_audit_logs` inexistentes) confirma que a condição de descongelamento do próprio log NÃO está
// cumprida.
//
// Decisão (2026-07-06, GO de Clayton "siga o fluxo de correções respeitando leis e normas"): substituir o
// 500 cru por contenção fail-closed HONESTA (blanket): 501 nomeado, ZERO chamada ao service, ZERO acesso ao
// DB, em TODAS as rotas (reads e writes batem nas mesmas tabelas ghost). O binding de autoridade fina
// (DECISION-0125/0126) que existia aqui era correto em intenção, mas roda sobre superfície MORTA — NÃO se faz
// binding sobre rota ghost. Contenção ≠ remoção: `policy-engine.service` e os grants preservados para um
// futuro caller quando o schema/ecossistema nascer (frente própria). Mesmo padrão de organization/automation.
import type { FastifyInstance } from 'fastify';

const POLICY_ENGINE_SCHEMA_GHOST_CONTAINED = {
  ok: false,
  code: 'POLICY_ENGINE_SCHEMA_GHOST_CONTAINED',
  message:
    'Policy Engine is not available because its canonical schema (policy_rules / policy_decisions) has not ' +
    'been materialized. (DT-MODULE-POLICY-ENGINE-AUDIT-URGENTE)',
};

const policyRoutes = async (fastify: FastifyInstance) => {
  // Handler de contenção único — curto-circuito fail-closed (501) ANTES de qualquer service/repository/DB.
  const contained = async (_req: any, reply: any) =>
    reply.status(501).send(POLICY_ENGINE_SCHEMA_GHOST_CONTAINED);

  // ── POLICIES (list/create/get/activate/deactivate/evaluate — todas batem nas tabelas ghost) ──
  fastify.get('/policies', contained);
  fastify.post('/policies', contained);
  fastify.get('/policies/:policyId', contained);
  fastify.post('/policies/:policyId/activate', contained);
  fastify.post('/policies/:policyId/deactivate', contained);
  fastify.get('/policies/evaluate/:actorId', contained);

  // ── POLICY DECISIONS (list/apply/get/revoke/active-by-actor — mesmas tabelas ghost) ──
  fastify.get('/policy-decisions', contained);
  fastify.post('/policy-decisions', contained);
  fastify.get('/policy-decisions/:decisionId', contained);
  fastify.post('/policy-decisions/:decisionId/revoke', contained);
  fastify.get('/policy-decisions/actor/:actorId/active', contained);
};

export default policyRoutes;
