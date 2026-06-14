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
   * Middleware: Verificar permissão para acessar Policy Engine (reads E mutations).
   *
   * 🔵 R2 (F-R2-COMPANY-USERS-FINE-GRANTS-MATERIALIZATION, 2026-06-13): a autoridade fina vem de
   * `company_users.can_manage_policy` (fonte material do R2 mínimo), NÃO do chain legado
   * businessAuthorizationService→organization_members (ausente ⇒ 403 sempre). SUBJECT = req.user.id
   * (server-side); o authorizer resolve a identidade global via JOIN canônico users.global_user_id e
   * inclui o fallback documentado can_manage_company/owner (mesma semântica de DECISION-0116). O `actorId`
   * de params/query/body (filtros de leitura, alvo de avaliação) NUNCA é subject.
   *
   * Decisão consciente (arquivo MIXED reads+mutations): em vez de manter o arquivo baselineado no guard
   * 0113, TODAS as rotas (GET reads + POST create/activate/deactivate/apply/revoke) passam pelo MESMO
   * gate `can_manage_policy`. Unificar reads sob a mesma capability das mutations é MAIS restritivo (não
   * abre leitura a quem não pode gerir) — sem perda de segurança — e torna o arquivo INTEIRO provável
   * (subject server-side em toda rota), permitindo o reconhecimento honesto pelo guard (sai do baseline).
   */
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
      const { allowed } = await companiesService.canUserPerformCompanyCapability(
        tenantId,
        userId,
        'can_manage_policy'
      );
      if (!allowed) {
        return reply.status(403).send({ error: 'Sem permissão para acessar Policy Engine' });
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
    { preHandler: requirePolicyPermission },
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
    { preHandler: requirePolicyPermission },
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





