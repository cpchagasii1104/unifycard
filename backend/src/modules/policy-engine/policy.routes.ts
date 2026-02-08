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
   * Middleware: Verificar permissão para acessar Policy Engine
   */
  const requirePolicyPermission = async (req: any, reply: any) => {
    const tenantId = req.tenant.id;
    const userId = req.user?.id;

    if (!userId) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    try {
      const { businessAuthorizationService } = await import('@core/authorization/business-authorization.service');
      const { getActiveActor } = await import('@core/actors/actor.helpers');
      
      const actor = await getActiveActor(tenantId, userId);
      if (!actor) {
        return reply.status(403).send({ error: 'Actor não encontrado' });
      }

      // Verificar permissão para acessar policy engine
      await businessAuthorizationService.requirePermission(
        tenantId,
        userId,
        actor.actor_id,
        'financial:view_all_ledger', // Reutilizar permissão de finance
        'policy_engine'
      );
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
      const tenantId = req.tenant.id;
      const userId = req.user?.id || '';
      const actorId = req.user?.actorId || '';

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
      const tenantId = req.tenant.id;
      const userId = req.user?.id || '';
      const actorId = req.user?.actorId || '';

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
      const tenantId = req.tenant.id;
      const decisions = await policyEngineService.getActiveDecisionsForActor(tenantId, req.params.actorId);

      return reply.send({ decisions });
    }
  );
};

export default policyRoutes;





