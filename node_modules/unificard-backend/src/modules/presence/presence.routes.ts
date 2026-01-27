// backend/src/modules/presence/presence.routes.ts
// SPRINT 94: PRESENÇA + CHECK-IN SOCIAL + BENEFÍCIOS PROMOCIONAIS

import type { FastifyInstance } from 'fastify';
import { presenceService } from './presence.service';
import { checkinService } from './checkin.service';
import { promoBenefitService } from './promo-benefit.service';
import { resolveActiveActorFromRequest } from '@modules/social/actor.utils';

/**
 * Rotas REST para Presence
 */
const presenceRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /presence/rsvp/confirm
   * Confirma presença
   */
  fastify.post<{
    Body: {
      contextType: 'EVENT' | 'VENUE';
      contextId: string;
      contactId: string;
      visibility?: 'PRIVATE' | 'PUBLIC';
    };
  }>('/rsvp/confirm', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { contextType, contextId, contactId, visibility } = req.body;

    const rsvp = await presenceService.confirmPresence(tenantId, {
      contextType,
      contextId,
      contactId,
      visibility,
    });

    return reply.status(201).send(rsvp);
  });

  /**
   * POST /presence/rsvp/cancel
   * Cancela presença
   */
  fastify.post<{
    Body: {
      contextType: 'EVENT' | 'VENUE';
      contextId: string;
      contactId: string;
    };
  }>('/rsvp/cancel', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { contextType, contextId, contactId } = req.body;

    const rsvp = await presenceService.cancelPresence(tenantId, contextType, contextId, contactId);

    return reply.send(rsvp);
  });

  /**
   * POST /presence/rsvp/:id/visibility
   * Altera visibilidade do RSVP
   */
  fastify.post<{
    Params: { id: string };
    Body: { visibility: 'PRIVATE' | 'PUBLIC' };
  }>('/rsvp/:id/visibility', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const rsvpId = req.params.id;
    const { visibility } = req.body;

    const rsvp = await presenceService.setVisibility(tenantId, rsvpId, visibility);

    return reply.send(rsvp);
  });

  /**
   * GET /presence/my?contactId=...
   * Lista minhas presenças
   */
  fastify.get<{
    Querystring: {
      contactId: string;
      status?: 'CONFIRMED' | 'CANCELLED' | 'ATTENDED' | 'NO_SHOW';
      limit?: number;
      offset?: number;
    };
  }>('/my', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { contactId, status, limit, offset } = req.query;

    if (!contactId) {
      return reply.status(400).send({ error: 'contactId é obrigatório' });
    }

    const rsvps = await presenceService.listMyPresence(tenantId, contactId, {
      status,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    return reply.send({ rsvps });
  });

  /**
   * GET /presence/:contextType/:contextId/public
   * Lista presenças públicas (read-only)
   */
  fastify.get<{
    Params: { contextType: 'EVENT' | 'VENUE'; contextId: string };
    Querystring: {
      status?: 'CONFIRMED' | 'CANCELLED' | 'ATTENDED' | 'NO_SHOW';
      limit?: number;
      offset?: number;
    };
  }>('/:contextType/:contextId/public', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { contextType, contextId } = req.params;
    const { status, limit, offset } = req.query;

    const rsvps = await presenceService.listPresence(tenantId, contextType, contextId, {
      visibility: 'PUBLIC', // Forçar PUBLIC
      status,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    return reply.send({ rsvps });
  });

  /**
   * POST /presence/:contextType/:contextId/tokens
   * Cria token de check-in (staff/admin)
   */
  fastify.post<{
    Params: { contextType: 'EVENT' | 'VENUE'; contextId: string };
    Body: {
      validFrom?: string;
      validTo?: string;
      metadata?: Record<string, any>;
    };
  }>('/:contextType/:contextId/tokens', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { contextType, contextId } = req.params;
    const { validFrom, validTo, metadata } = req.body;

    const actor = await resolveActiveActorFromRequest(req);
    if (!actor) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const token = await checkinService.createToken(
      tenantId,
      {
        contextType,
        contextId,
        validFrom: validFrom ? new Date(validFrom) : null,
        validTo: validTo ? new Date(validTo) : null,
        metadata,
      },
      actor.id,
      req.user?.id || null
    );

    return reply.status(201).send(token);
  });

  /**
   * POST /presence/tokens/:id/revoke
   * Revoga token (staff/admin)
   */
  fastify.post<{
    Params: { id: string };
  }>('/tokens/:id/revoke', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const tokenId = req.params.id;

    await checkinService.revokeToken(tenantId, tokenId);

    return reply.send({ success: true });
  });

  /**
   * POST /presence/checkin/by-token
   * Check-in por token (público)
   */
  fastify.post<{
    Body: {
      token: string;
      contactId: string;
      referenceEventId?: string;
    };
  }>('/checkin/by-token', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { token, contactId, referenceEventId } = req.body;

    const result = await checkinService.checkInByToken(tenantId, {
      token,
      contactId,
      referenceEventId: referenceEventId || null,
    });

    return reply.status(201).send(result);
  });

  /**
   * POST /presence/:contextType/:contextId/checkin/manual
   * Check-in manual (staff/admin)
   */
  fastify.post<{
    Params: { contextType: 'EVENT' | 'VENUE'; contextId: string };
    Body: {
      contactId: string;
    };
  }>('/:contextType/:contextId/checkin/manual', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { contextType, contextId } = req.params;
    const { contactId } = req.body;

    const result = await checkinService.manualCheckIn(tenantId, {
      contextType,
      contextId,
      contactId,
    });

    return reply.status(201).send(result);
  });

  /**
   * POST /presence/:contextType/:contextId/checkout
   * Check-out (staff/admin)
   */
  fastify.post<{
    Params: { contextType: 'EVENT' | 'VENUE'; contextId: string };
    Body: {
      contactId: string;
    };
  }>('/:contextType/:contextId/checkout', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { contextType, contextId } = req.params;
    const { contactId } = req.body;

    const checkout = await checkinService.checkOut(tenantId, contextType, contextId, contactId);

    return reply.status(201).send(checkout);
  });

  /**
   * GET /presence/:contextType/:contextId/stats
   * Estatísticas de presença (staff/admin)
   */
  fastify.get<{
    Params: { contextType: 'EVENT' | 'VENUE'; contextId: string };
  }>('/:contextType/:contextId/stats', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { contextType, contextId } = req.params;

    const stats = await checkinService.getAttendanceStats(tenantId, contextType, contextId);

    return reply.send(stats);
  });

  /**
   * POST /presence/:contextType/:contextId/benefits
   * Cria benefício promocional (staff/admin)
   */
  fastify.post<{
    Params: { contextType: 'EVENT' | 'VENUE'; contextId: string };
    Body: {
      benefitType: 'LOYALTY_POINTS' | 'LOYALTY_MULTIPLIER' | 'VOUCHER';
      benefitValue: number;
      requiresCheckin?: boolean;
      maxRedemptions?: number | null;
      perContactLimit?: number;
      validFrom?: string | null;
      validTo?: string | null;
      metadata?: Record<string, any>;
    };
  }>('/:contextType/:contextId/benefits', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { contextType, contextId } = req.params;
    const {
      benefitType,
      benefitValue,
      requiresCheckin,
      maxRedemptions,
      perContactLimit,
      validFrom,
      validTo,
      metadata,
    } = req.body;

    const benefit = await promoBenefitService.createBenefit(tenantId, {
      contextType,
      contextId,
      benefitType,
      benefitValue,
      requiresCheckin,
      maxRedemptions: maxRedemptions || null,
      perContactLimit,
      validFrom: validFrom ? new Date(validFrom) : null,
      validTo: validTo ? new Date(validTo) : null,
      metadata,
    });

    return reply.status(201).send(benefit);
  });

  /**
   * GET /presence/:contextType/:contextId/benefits
   * Lista benefícios promocionais
   */
  fastify.get<{
    Params: { contextType: 'EVENT' | 'VENUE'; contextId: string };
  }>('/:contextType/:contextId/benefits', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { contextType, contextId } = req.params;

    const benefits = await promoBenefitService.listBenefits(tenantId, contextType, contextId);

    return reply.send({ benefits });
  });
};

export default presenceRoutes;

