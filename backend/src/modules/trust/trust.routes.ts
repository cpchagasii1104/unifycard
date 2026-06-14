// backend/src/modules/trust/trust.routes.ts
// Rotas para Trust & Integrity Engine
// 🔴 BLINDAGEM: Nenhum score editável manualmente

import type { FastifyInstance } from 'fastify';
import { trustEngineService } from './trust-engine.service';
import type { RegisterTrustEventInput, CanProceedInput } from './trust.types';

const trustRoutes = async (fastify: FastifyInstance) => {
  // 🔵 R2.4 UNFREEZE (F-R2-TRUST-TENANT-GRANTS-R24-UNFREEZE, 2026-06-14, DECISION-0127): o gate-admin INTERINO
  // (requireRole(['admin'])) foi SUBSTITUÍDO por grant material TENANT-LEVEL em tenant_operator_grants. Trust =
  // compliance/risco/anti-fraude TENANT-SCOPED (mapa de risco do tenant; actorId = alvo/filtro, NUNCA subject).
  // SUBJECT = req.user.id server-side (→global_user_id via JOIN canônico). company_users.can_* NÃO autoriza trust
  // tenant-level. Grant em tenant A não vale tenant B. View e manage SEPARADOS. Trust NÃO toca dinheiro (as refs a
  // "dispute" são apenas tipos de evento de score). Reads → can_view_tenant_trust; mutations/recalculate → can_manage_tenant_trust.
  const requireTrustView = async (req: any, reply: any) => {
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
      const { allowed } = await companiesService.canUserPerformTenantCapability(tenantId, userId, 'can_view_tenant_trust');
      if (!allowed) {
        return reply.status(403).send({ error: 'Sem grant tenant-level para ler trust (can_view_tenant_trust)', code: 'TENANT_GRANT_REQUIRED' });
      }
    } catch {
      return reply.status(403).send({ error: 'Sem grant tenant-level para trust' });
    }
  };
  const requireTrustManage = async (req: any, reply: any) => {
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
      const { allowed } = await companiesService.canUserPerformTenantCapability(tenantId, userId, 'can_manage_tenant_trust');
      if (!allowed) {
        return reply.status(403).send({ error: 'Sem grant tenant-level para gerir trust (can_manage_tenant_trust)', code: 'TENANT_GRANT_REQUIRED' });
      }
    } catch {
      return reply.status(403).send({ error: 'Sem grant tenant-level para trust' });
    }
  };

  /**
   * GET /trust/profile/:actorId
   * Busca trust profile por actor
   */
  fastify.get<{ Params: { actorId: string } }>('/trust/profile/:actorId', { preHandler: requireTrustView }, async (req, reply) => {
    if (!req.tenant) {
      return reply.status(400).send({ error: 'tenant required' });
    }
    const tenantId = req.tenant.id;
    const profile = await trustEngineService.getTrustProfile(tenantId, req.params.actorId);

    return reply.send({ profile });
  });

  /**
   * GET /trust/profiles
   * Lista trust profiles com filtros
   */
  fastify.get<{
    Querystring: {
      actorId?: string;
      riskLevel?: string;
      minScore?: number;
      maxScore?: number;
      limit?: number;
      offset?: number;
    };
  }>('/trust/profiles', { preHandler: requireTrustView }, async (req, reply) => {
    if (!req.tenant) {
      return reply.status(400).send({ error: 'tenant required' });
    }
    const tenantId = req.tenant.id;
    const filters = {
      actorId: req.query.actorId,
      riskLevel: req.query.riskLevel as any,
      minScore: req.query.minScore,
      maxScore: req.query.maxScore,
      limit: req.query.limit,
      offset: req.query.offset,
    };

    const profiles = await trustEngineService.listTrustProfiles(tenantId, filters);

    return reply.send({ profiles, totalCents: profiles.length });
  });

  /**
   * GET /trust/events
   * Lista trust events com filtros
   */
  fastify.get<{
    Querystring: {
      actorId?: string;
      eventType?: string;
      severity?: string;
      contextType?: string;
      contextId?: string;
      limit?: number;
      offset?: number;
    };
  }>('/trust/events', { preHandler: requireTrustView }, async (req, reply) => {
    if (!req.tenant) {
      return reply.status(400).send({ error: 'tenant required' });
    }
    const tenantId = req.tenant.id;
    const filters = {
      actorId: req.query.actorId,
      eventType: req.query.eventType as any,
      severity: req.query.severity as any,
      contextType: req.query.contextType as any,
      contextId: req.query.contextId,
      limit: req.query.limit,
      offset: req.query.offset,
    };

    const events = await trustEngineService.listTrustEvents(tenantId, filters);

    return reply.send({ events, totalCents: events.length });
  });

  /**
   * POST /trust/events
   * Registra evento de trust
   */
  fastify.post<{ Body: RegisterTrustEventInput }>('/trust/events', { preHandler: requireTrustManage }, async (req, reply) => {
    if (!req.tenant) {
      return reply.status(400).send({ error: 'tenant required' });
    }
    const tenantId = req.tenant.id;
    const result = await trustEngineService.registerTrustEvent(tenantId, req.body);

    return reply.status(201).send(result);
  });

  /**
   * POST /trust/can-proceed
   * Verifica se pode prosseguir com ação baseado em trust score
   */
  fastify.post<{ Body: CanProceedInput }>('/trust/can-proceed', { preHandler: requireTrustView }, async (req, reply) => {
    if (!req.tenant) {
      return reply.status(400).send({ error: 'tenant required' });
    }
    const tenantId = req.tenant.id;
    const result = await trustEngineService.canProceedWithAction(tenantId, req.body);

    return reply.send(result);
  });

  /**
   * POST /trust/recalculate/:actorId
   * Recalcula score de um actor
   */
  fastify.post<{ Params: { actorId: string } }>('/trust/recalculate/:actorId', { preHandler: requireTrustManage }, async (req, reply) => {
    if (!req.tenant) {
      return reply.status(400).send({ error: 'tenant required' });
    }
    const tenantId = req.tenant.id;
    const profile = await trustEngineService.recalculateScore(tenantId, req.params.actorId);

    return reply.send({ profile });
  });
};

export default trustRoutes;





