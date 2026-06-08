// backend/src/modules/trust/trust.routes.ts
// Rotas para Trust & Integrity Engine
// 🔴 BLINDAGEM: Nenhum score editável manualmente

import type { FastifyInstance } from 'fastify';
import { trustEngineService } from './trust-engine.service';
import type { RegisterTrustEventInput, CanProceedInput } from './trust.types';

const trustRoutes = async (fastify: FastifyInstance) => {
  // 🔴 DECISION-0113 (trust = compliance/risco/anti-fraude, NÃO vitrine pública): GATE-ADMIN INTERINO.
  // O módulo estava 100% NU (só `req.tenant`), reads E writes → qualquer caller lia o mapa de risco do
  // tenant E injetava/recalculava sinais de fraude. Compliance opera CROSS-ACTOR por design → `canRepresentActor`
  // seria ERRADO (bloquearia o operador legítimo). Gate = role-admin real (mecanismo canônico da fatia 1).
  // INTERINO: o modelo fino de compliance/risk (permissão específica) fica para R2.4 — NÃO criar permission nova aqui.
  const adminOnly = (fastify as unknown as { requireRole: (roles: string[]) => unknown }).requireRole(['admin']);

  /**
   * GET /trust/profile/:actorId
   * Busca trust profile por actor
   */
  fastify.get<{ Params: { actorId: string } }>('/trust/profile/:actorId', { preHandler: adminOnly as never }, async (req, reply) => {
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
  }>('/trust/profiles', { preHandler: adminOnly as never }, async (req, reply) => {
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
  }>('/trust/events', { preHandler: adminOnly as never }, async (req, reply) => {
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
  fastify.post<{ Body: RegisterTrustEventInput }>('/trust/events', { preHandler: adminOnly as never }, async (req, reply) => {
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
  fastify.post<{ Body: CanProceedInput }>('/trust/can-proceed', { preHandler: adminOnly as never }, async (req, reply) => {
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
  fastify.post<{ Params: { actorId: string } }>('/trust/recalculate/:actorId', { preHandler: adminOnly as never }, async (req, reply) => {
    if (!req.tenant) {
      return reply.status(400).send({ error: 'tenant required' });
    }
    const tenantId = req.tenant.id;
    const profile = await trustEngineService.recalculateScore(tenantId, req.params.actorId);

    return reply.send({ profile });
  });
};

export default trustRoutes;





