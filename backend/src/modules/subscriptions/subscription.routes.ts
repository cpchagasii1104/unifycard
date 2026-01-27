// backend/src/modules/subscriptions/subscription.routes.ts
// SPRINT 87: ASSINATURAS (RECORRÊNCIA AUDITÁVEL)

import type { FastifyInstance } from 'fastify';
import { subscriptionService } from './subscription.service';
import { resolveActiveActorFromRequest } from '@modules/social/actor.utils';

/**
 * Rotas REST para Subscriptions
 */
const subscriptionRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /subscriptions
   * Cria assinatura
   */
  fastify.post<{
    Body: {
      contactId: string;
      paymentLinkId: string;
      amount: number;
      currency?: string;
      interval: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
      intervalCount?: number;
      dayOfMonth?: number | null;
      nextRunAt?: string;
      maxFailures?: number;
      metadata?: Record<string, any>;
    };
  }>('/', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const {
      contactId,
      paymentLinkId,
      amount,
      currency,
      interval,
      intervalCount,
      dayOfMonth,
      nextRunAt,
      maxFailures,
      metadata,
    } = req.body;

    const actor = await resolveActiveActorFromRequest(req, tenantId, {
      allowUserFallback: true,
      userId: req.user?.id,
    });

    const subscription = await subscriptionService.createSubscription(
      tenantId,
      actor.actor_id,
      req.user?.id || null,
      {
        contactId,
        paymentLinkId,
        amount,
        currency,
        interval,
        intervalCount,
        dayOfMonth,
        nextRunAt: nextRunAt ? new Date(nextRunAt) : undefined,
        maxFailures,
        metadata,
      }
    );

    return reply.status(201).send(subscription);
  });

  /**
   * GET /subscriptions
   * Lista assinaturas
   */
  fastify.get<{
    Querystring: {
      contactId?: string;
      paymentLinkId?: string;
      status?: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
      limit?: number;
      offset?: number;
    };
  }>('/', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const query = req.query;

    const filters: any = {};
    if (query.contactId) filters.contactId = query.contactId;
    if (query.paymentLinkId) filters.paymentLinkId = query.paymentLinkId;
    if (query.status) filters.status = query.status;
    if (query.limit) filters.limit = parseInt(query.limit as string, 10);
    if (query.offset) filters.offset = parseInt(query.offset as string, 10);

    const subscriptions = await subscriptionService.listSubscriptions(tenantId, filters);

    return reply.send({ subscriptions });
  });

  /**
   * GET /subscriptions/:id
   * Busca assinatura por ID
   */
  fastify.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const subscriptionId = req.params.id;

    const subscription = await subscriptionService.getSubscriptionById(tenantId, subscriptionId);

    if (!subscription) {
      return reply.status(404).send({ error: 'Assinatura não encontrada' });
    }

    return reply.send(subscription);
  });

  /**
   * POST /subscriptions/:id/pause
   * Pausa assinatura
   */
  fastify.post<{ Params: { id: string } }>('/:id/pause', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const subscriptionId = req.params.id;

    const actor = await resolveActiveActorFromRequest(req, tenantId, {
      allowUserFallback: true,
      userId: req.user?.id,
    });

    const subscription = await subscriptionService.pauseSubscription(
      tenantId,
      subscriptionId,
      actor.actor_id,
      req.user?.id || null
    );

    return reply.send(subscription);
  });

  /**
   * POST /subscriptions/:id/resume
   * Retoma assinatura
   */
  fastify.post<{ Params: { id: string } }>('/:id/resume', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const subscriptionId = req.params.id;

    const actor = await resolveActiveActorFromRequest(req, tenantId, {
      allowUserFallback: true,
      userId: req.user?.id,
    });

    const subscription = await subscriptionService.resumeSubscription(
      tenantId,
      subscriptionId,
      actor.actor_id,
      req.user?.id || null
    );

    return reply.send(subscription);
  });

  /**
   * POST /subscriptions/:id/cancel
   * Cancela assinatura
   */
  fastify.post<{ Params: { id: string } }>('/:id/cancel', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const subscriptionId = req.params.id;

    const actor = await resolveActiveActorFromRequest(req, tenantId, {
      allowUserFallback: true,
      userId: req.user?.id,
    });

    const subscription = await subscriptionService.cancelSubscription(
      tenantId,
      subscriptionId,
      actor.actor_id,
      req.user?.id || null
    );

    return reply.send(subscription);
  });

  /**
   * POST /subscriptions/run-due
   * Agenda execuções de assinaturas vencidas (admin/internal)
   */
  fastify.post<{
    Body: {
      limit?: number;
    };
  }>('/run-due', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const limit = req.body.limit || 50;

    const result = await subscriptionService.runDueSubscriptions(tenantId, limit);

    return reply.send(result);
  });
};

export default subscriptionRoutes;

