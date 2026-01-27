// backend/src/modules/trust/trust.routes.ts
// Rotas para Trust & Integrity Engine
// 🔴 BLINDAGEM: Nenhum score editável manualmente

import type { FastifyInstance } from 'fastify';
import { trustEngineService } from './trust-engine.service';
import type { RegisterTrustEventInput, CanProceedInput } from './trust.types';

const trustRoutes = async (fastify: FastifyInstance) => {
  /**
   * GET /trust/profile/:actorId
   * Busca trust profile por actor
   */
  fastify.get<{ Params: { actorId: string } }>('/trust/profile/:actorId', async (req, reply) => {
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
  }>('/trust/profiles', async (req, reply) => {
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

    return reply.send({ profiles, total: profiles.length });
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
  }>('/trust/events', async (req, reply) => {
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

    return reply.send({ events, total: events.length });
  });

  /**
   * POST /trust/events
   * Registra evento de trust
   */
  fastify.post<{ Body: RegisterTrustEventInput }>('/trust/events', async (req, reply) => {
    const tenantId = req.tenant.id;
    const result = await trustEngineService.registerTrustEvent(tenantId, req.body);

    return reply.status(201).send(result);
  });

  /**
   * POST /trust/can-proceed
   * Verifica se pode prosseguir com ação baseado em trust score
   */
  fastify.post<{ Body: CanProceedInput }>('/trust/can-proceed', async (req, reply) => {
    const tenantId = req.tenant.id;
    const result = await trustEngineService.canProceedWithAction(tenantId, req.body);

    return reply.send(result);
  });

  /**
   * POST /trust/recalculate/:actorId
   * Recalcula score de um actor
   */
  fastify.post<{ Params: { actorId: string } }>('/trust/recalculate/:actorId', async (req, reply) => {
    const tenantId = req.tenant.id;
    const profile = await trustEngineService.recalculateScore(tenantId, req.params.actorId);

    return reply.send({ profile });
  });
};

export default trustRoutes;




