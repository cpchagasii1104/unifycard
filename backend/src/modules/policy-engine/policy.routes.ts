// backend/src/modules/policy-engine/policy.routes.ts
// Rotas para Policy & Enforcement Engine
// 🔴 BLINDAGEM: RBAC obrigatório (apenas OWNER/ADMIN/FINANCE)

import type { FastifyInstance } from 'fastify';
import { policyEngineService } from './policy-engine.service';
import type {
  CreatePolicyInput,
  ApplyPolicyDecisionInput,
  RevokePolicyDecisionInput,
  PolicyFilters,
  PolicyDecisionFilters,
} from './policy.types';

const policyRoutes = async (fastify: FastifyInstance) => {
  /**
   * Middleware: Policy Engine — autoridade fina `company_users.can_manage_policy` (DECISION-0125).
   *
   * 🔴 ESCOPO R2 (F-R2-FINE-GRANTS-ANCHOR-AND-SCOPE-CLOSURE, 2026-06-14, reseal Yala / decisão Clayton):
   * grant COMPANY-SCOPED — não autoriza tenant-wide. SUBJECT = req.user.id (server-side); actorId = alvo,
   * NUNCA subject. As rotas tenant-wide/mixed (listar/criar/ativar/desativar políticas e decisões, aplicar/
   * revogar) NÃO têm empresa-alvo resolvível e gerem estado tenant-wide → **FAIL-CLOSED**
   * (company_scope_required), DECISION_REQUIRED (platform-admin/tenant-level grant).
   */
  // Rotas TENANT-WIDE/MIXED (listar/criar/ativar/desativar políticas e decisões, aplicar/revogar): gerem
  // estado tenant-wide de POLÍTICA (policy_rules/policy_decisions — registros internos, SEM efeito financeiro
  // nem chamada externa; nenhum bank_*/payout/reversal). Autoridade = modelo SEPARADO
  // `tenant_operator_grants.can_manage_tenant_policy` (DECISION-0126) — NÃO company_users/can_manage_company
  // (grant de empresa não abre tenant-wide). SUBJECT = req.user.id (server-side). Grant tenant A ≠ tenant B.
  const requirePolicyPermission = async (req: any, reply: any) => {
    if (!req.tenant) {
      return reply.status(400).send({ error: 'tenant required' });
    }
    const tenantId = req.tenant.id;
    const userId = req.user?.id;
    if (!userId) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }
    try {
      const { companiesService } = await import('@core/companies/companies.service');
      const { allowed } = await companiesService.canUserPerformTenantCapability(
        tenantId,
        userId,
        'can_manage_tenant_policy'
      );
      if (!allowed) {
        return reply.status(403).send({ error: 'Sem grant tenant-level para Policy Engine (can_manage_tenant_policy)', code: 'TENANT_GRANT_REQUIRED' });
      }
    } catch {
      return reply.status(403).send({ error: 'Sem grant tenant-level para Policy Engine' });
    }
  };

  // Rotas ACTOR-SCOPED (/policies/evaluate/:actorId, /policy-decisions/actor/:actorId/active): o output é
  // do actor-alvo. Resolve a empresa material do actor (actors.company_id) e exige can_manage_policy NAQUELA
  // empresa. Sem company resolvível → fail-closed company_scope_required.
  const requirePolicyActorScoped = async (req: any, reply: any) => {
    if (!req.tenant) {
      return reply.status(400).send({ error: 'tenant required' });
    }
    const tenantId = req.tenant.id;
    const userId = req.user?.id;
    if (!userId) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }
    try {
      const { companiesService } = await import('@core/companies/companies.service');
      const companyId = await companiesService.resolveCompanyIdForActor(tenantId, req.params?.actorId);
      if (!companyId) {
        return reply.status(403).send({ error: 'Actor-alvo sem empresa resolvível — escopo company obrigatório', code: 'COMPANY_SCOPE_REQUIRED' });
      }
      const { allowed } = await companiesService.canUserPerformCompanyCapability(
        tenantId,
        userId,
        'can_manage_policy',
        { companyId }
      );
      if (!allowed) {
        return reply.status(403).send({ error: 'Sem permissão para Policy Engine desta empresa' });
      }
    } catch (permError: any) {
      return reply.status(403).send({ error: 'Sem permissão para acessar Policy Engine' });
    }
  };

  /**
   * GET /policies
   * Lista políticas com filtros
   */
  fastify.get<{
    Querystring: {
      policyType?: string;
      isActive?: boolean;
      limit?: number;
      offset?: number;
    };
  }>('/policies', { preHandler: requirePolicyPermission }, async (req, reply) => {
    if (!req.tenant) {
      return reply.status(400).send({ error: 'tenant required' });
    }
    const tenantId = req.tenant.id;
    const filters: PolicyFilters = {
      policyType: req.query.policyType as any,
      isActive: req.query.isActive === true,
      limit: req.query.limit,
      offset: req.query.offset,
    };

    const policies = await policyEngineService.listPolicies(tenantId, filters);

    return reply.send({ policies, totalCents: policies.length });
  });

  /**
   * POST /policies
   * Cria uma nova política
   */
  fastify.post<{ Body: CreatePolicyInput }>('/policies', { preHandler: requirePolicyPermission }, async (req, reply) => {
    if (!req.tenant) {
      return reply.status(400).send({ error: 'tenant required' });
    }
    const tenantId = req.tenant.id;
    const userId = req.user?.id || '';

    const policy = await policyEngineService.createPolicy(tenantId, req.body, userId);

    return reply.status(201).send({ policy });
  });

  /**
   * GET /policies/:policyId
   * Busca política por ID
   */
  fastify.get<{ Params: { policyId: string } }>(
    '/policies/:policyId',
    { preHandler: requirePolicyPermission },
    async (req, reply) => {
      if (!req.tenant) {
        return reply.status(400).send({ error: 'tenant required' });
      }
      const tenantId = req.tenant.id;
      const policy = await policyEngineService.getPolicy(tenantId, req.params.policyId);

      return reply.send({ policy });
    }
  );

  /**
   * POST /policies/:policyId/activate
   * Ativa uma política
   */
  fastify.post<{ Params: { policyId: string } }>(
    '/policies/:policyId/activate',
    { preHandler: requirePolicyPermission },
    async (req, reply) => {
      if (!req.tenant) {
        return reply.status(400).send({ error: 'tenant required' });
      }
      const tenantId = req.tenant.id;
      const userId = req.user?.id || '';

      const policy = await policyEngineService.activatePolicy(tenantId, req.params.policyId, userId);

      return reply.send({ policy });
    }
  );

  /**
   * POST /policies/:policyId/deactivate
   * Desativa uma política
   */
  fastify.post<{ Params: { policyId: string } }>(
    '/policies/:policyId/deactivate',
    { preHandler: requirePolicyPermission },
    async (req, reply) => {
      if (!req.tenant) {
        return reply.status(400).send({ error: 'tenant required' });
      }
      const tenantId = req.tenant.id;
      const userId = req.user?.id || '';

      const policy = await policyEngineService.deactivatePolicy(tenantId, req.params.policyId, userId);

      return reply.send({ policy });
    }
  );

  /**
   * GET /policies/evaluate/:actorId
   * Avalia políticas para um actor (apenas recomendações)
   */
  fastify.get<{ Params: { actorId: string } }>(
    '/policies/evaluate/:actorId',
    { preHandler: requirePolicyActorScoped },
    async (req, reply) => {
      if (!req.tenant) {
        return reply.status(400).send({ error: 'tenant required' });
      }
      const tenantId = req.tenant.id;
      const evaluations = await policyEngineService.evaluatePoliciesForActor(tenantId, req.params.actorId);

      return reply.send({ evaluations });
    }
  );

  /**
   * GET /policy-decisions
   * Lista decisões com filtros
   */
  fastify.get<{
    Querystring: {
      policyId?: string;
      actorId?: string;
      status?: string;
      limit?: number;
      offset?: number;
    };
  }>('/policy-decisions', { preHandler: requirePolicyPermission }, async (req, reply) => {
    if (!req.tenant) {
      return reply.status(400).send({ error: 'tenant required' });
    }
    const tenantId = req.tenant.id;
    const filters: PolicyDecisionFilters = {
      policyId: req.query.policyId,
      actorId: req.query.actorId,
      status: req.query.status as any,
      limit: req.query.limit,
      offset: req.query.offset,
    };

    const decisions = await policyEngineService.listDecisions(tenantId, filters);

    return reply.send({ decisions, totalCents: decisions.length });
  });

  /**
   * POST /policy-decisions
   * Aplica uma decisão de política manualmente
   */
  fastify.post<{ Body: ApplyPolicyDecisionInput }>(
    '/policy-decisions',
    { preHandler: requirePolicyPermission },
    async (req, reply) => {
      if (!req.tenant) {
        return reply.status(400).send({ error: 'tenant required' });
      }
      const tenantId = req.tenant.id;
      const userId = req.user?.id || '';
      const actorId = (req.user as { actorId?: string } | undefined)?.actorId ?? '';

      const decision = await policyEngineService.applyPolicyDecision(
        tenantId,
        req.body,
        userId,
        actorId
      );

      return reply.status(201).send({ decision });
    }
  );

  /**
   * GET /policy-decisions/:decisionId
   * Busca decisão por ID
   */
  fastify.get<{ Params: { decisionId: string } }>(
    '/policy-decisions/:decisionId',
    { preHandler: requirePolicyPermission },
    async (req, reply) => {
      if (!req.tenant) {
        return reply.status(400).send({ error: 'tenant required' });
      }
      const tenantId = req.tenant.id;
      const decision = await policyEngineService.getDecision(tenantId, req.params.decisionId);

      return reply.send({ decision });
    }
  );

  /**
   * POST /policy-decisions/:decisionId/revoke
   * Revoga uma decisão
   */
  fastify.post<{ Params: { decisionId: string }; Body: RevokePolicyDecisionInput }>(
    '/policy-decisions/:decisionId/revoke',
    { preHandler: requirePolicyPermission },
    async (req, reply) => {
      if (!req.tenant) {
        return reply.status(400).send({ error: 'tenant required' });
      }
      const tenantId = req.tenant.id;
      const userId = req.user?.id || '';
      const actorId = (req.user as { actorId?: string } | undefined)?.actorId ?? '';

      const decision = await policyEngineService.revokeDecision(
        tenantId,
        req.params.decisionId,
        userId,
        actorId,
        req.body.revocationReason
      );

      return reply.send({ decision });
    }
  );

  /**
   * GET /policy-decisions/actor/:actorId/active
   * Busca decisões ativas para um actor
   */
  fastify.get<{ Params: { actorId: string } }>(
    '/policy-decisions/actor/:actorId/active',
    { preHandler: requirePolicyActorScoped },
    async (req, reply) => {
      if (!req.tenant) {
        return reply.status(400).send({ error: 'tenant required' });
      }
      const tenantId = req.tenant.id;
      const decisions = await policyEngineService.getActiveDecisionsForActor(tenantId, req.params.actorId);

      return reply.send({ decisions });
    }
  );
};

export default policyRoutes;





