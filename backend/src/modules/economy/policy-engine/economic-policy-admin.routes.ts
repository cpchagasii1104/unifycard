// backend/src/modules/economy/policy-engine/economic-policy-admin.routes.ts
//
// F-ECONOMIC-POLICY-ADMIN-FRONT — FATIA 1 (authority key + read-only consumer).
//
// 🔒 BLINDAGEM (DECISION-0166 D6): esta rota é o consumidor READ-ONLY que prova que a chave
// `economic_policy:manage` (permission-keys.ts) NÃO é vocabulário fantasma. Lista policies e
// linhas — NUNCA cria, altera, aprova nem executa nada financeiro. "Admin configura policy;
// admin NÃO move dinheiro. O Bank executa." A escrita (Fatia 3) e a tela (Fatia 4) são fatias
// FUTURAS, com seu próprio GATE/GO — nada disso vive aqui.
//
// GATE REAL: `requireRole(['admin'])` — o MESMO mecanismo institucional já usado por
// `core/categories/ssot-admin.routes.ts`, `core/unifybank/transparency-admin.routes.ts`,
// o irmão de leitura consolidada do módulo Bank (unifybank) e `modules/trust/trust.routes.ts`
// (RBAC V2, `actor_has_any_role` — função REAL, restaurada em 20260530551000). Tenant SEMPRE
// de `req.tenant` (nunca query/body) — mesma disciplina de
// DT-INTERNAL-SSOT-ADMIN-TENANT-QUERY-HYGIENE.
//
// SEGUNDA CAMADA (prova que a chave NÃO é ghost): `requirePermission('economic_policy:manage')`
// (authority.service/canActAs — vocabulário PermissionKey) roda DEPOIS do requireRole e
// referencia a chave literalmente. Deliberadamente NÃO usamos `fastify.requirePermission([...])`
// (o decorator RBAC V2 baseado em `role_permissions`) porque `actor_has_permission` é um STUB
// fail-closed que retorna FALSE SEMPRE (DECISION-0013/C47, `20260422000100_...sql`) — gatear
// com ele tornaria esta rota permanentemente inacessível, mesmo para admins reais.
//
// PONTO DE EXTENSÃO (comentário, não implementação): hoje a autoridade sobre a regra de uma
// cidade é platform-admin (DECISION-0177). Um futuro 2º nível de autoridade (local/comunitário)
// é questão em aberto — NÃO decidida aqui. Se vier, o ponto de extensão é o preHandler abaixo
// (trocar/adicionar um segundo requireRole/requirePermission), não um mecanismo paralelo.

import { FastifyPluginAsync } from 'fastify';
import { economicPolicyRepository } from './economic-policy.repository';
import { requirePermission } from '@core/authorization/require-permission.guard';
import type { PermissionKey } from '@core/authorization/permission-keys';

/** Chave de autoridade desta fatia — DECISION-0166 D6 (define REGRA; nunca move dinheiro). */
const ECONOMIC_POLICY_MANAGE_KEY: PermissionKey = 'economic_policy:manage';

const economicPolicyAdminRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /economy/admin/policies
   * Lista as economic_policies (+ linhas) do TENANT AUTENTICADO. READ-ONLY.
   * Nenhum filtro de escopo aceito via query/body — tenant é SEMPRE req.tenant.id.
   */
  fastify.get(
    '/admin/policies',
    {
      preHandler: [
        // Mesmo padrão de core/categories/ssot-admin.routes.ts (requireRole real, actor_has_any_role).
        async (req, reply) => {
          await (fastify as any).requireRole(['admin'])(req, reply);
        },
        requirePermission(ECONOMIC_POLICY_MANAGE_KEY),
      ],
    },
    async (req, reply) => {
      if (!req.user || !req.tenant?.id) {
        return reply.status(401).send({ ok: false, message: 'Não autenticado' });
      }
      const tenantId = req.tenant.id;
      try {
        const policies = await economicPolicyRepository.listPoliciesForTenant(tenantId);
        const withLines = await Promise.all(
          policies.map(async (policy) => ({
            ...policy,
            lines: await economicPolicyRepository.findPolicyLines(tenantId, policy.id),
          }))
        );
        return reply.send({ ok: true, data: withLines });
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao listar economic policies (admin read-only)');
        return reply.status(500).send({ ok: false, message: 'Erro ao listar economic policies' });
      }
    }
  );
};

export default economicPolicyAdminRoutes;
