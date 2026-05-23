// backend/src/modules/crm/crm.routes.ts
// SPRINT 88: CRM CANÔNICO

import type { FastifyInstance } from 'fastify';
import type { CrmTimelineFilters, CrmTimelineEventType } from './crm.types';
import { crmService } from './crm.service';
import { resolveActiveActorFromRequest } from '@modules/social/actor.utils';

/**
 * Rotas REST para CRM
 */
const crmRoutes = async (fastify: FastifyInstance) => {
  /**
   * GET /crm/contacts/:id/timeline
   * Busca timeline do contato (read-only, consolidado)
   */
  fastify.get<{
    Params: { id: string };
    Querystring: {
      eventTypes?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    };
  }>('/contacts/:id/timeline', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const contactId = req.params.id;

    const filters: CrmTimelineFilters = {};
    if (req.query.eventTypes) {
      const valid: CrmTimelineEventType[] = ['ORDER_CREATED', 'ORDER_PAID', 'TICKET_PURCHASED', 'CHECKIN', 'PAYMENT_LINK_USED', 'RECEIVABLE_CREATED', 'FISCAL_DRAFT', 'FISCAL_ISSUED', 'NOTE_ADDED', 'TAG_ASSIGNED', 'TAG_REMOVED', 'CONSENT_CHANGED'];
      const raw = Array.isArray(req.query.eventTypes) ? req.query.eventTypes : [req.query.eventTypes];
      filters.eventTypes = raw.filter((t): t is CrmTimelineEventType => valid.includes(t as CrmTimelineEventType));
    }
    if (req.query.startDate) {
      filters.startDate = new Date(req.query.startDate);
    }
    if (req.query.endDate) {
      filters.endDate = new Date(req.query.endDate);
    }
    if (req.query.limit != null) filters.limit = Number(req.query.limit);
    if (req.query.offset != null) filters.offset = Number(req.query.offset);

    const timeline = await crmService.getTimeline(tenantId, contactId, filters);

    return reply.send({ timeline });
  });

  /**
   * POST /crm/contacts/:id/notes
   * Adiciona nota ao contato
   */
  fastify.post<{
    Params: { id: string };
    Body: {
      note: string;
      visibility?: 'INTERNAL' | 'SHARED';
      metadata?: Record<string, any>;
    };
  }>('/contacts/:id/notes', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const contactId = req.params.id;
    const { note, visibility, metadata } = req.body;

    const actor = await resolveActiveActorFromRequest(req, tenantId, {
      allowUserFallback: true,
      userId: req.user?.id,
    });

    const createdNote = await crmService.addNote(
      tenantId,
      actor.actor_id,
      req.user?.id || null,
      {
        contactId,
        note,
        visibility,
        metadata,
      }
    );

    return reply.send(createdNote);
  });

  /**
   * GET /crm/contacts/:id/notes
   * Lista notas do contato
   */
  fastify.get<{ Params: { id: string } }>('/contacts/:id/notes', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const contactId = req.params.id;

    const notes = await crmService.listNotes(tenantId, contactId);

    return reply.send({ notes });
  });

  /**
   * POST /crm/tags
   * Cria tag
   */
  fastify.post<{
    Body: {
      name: string;
      color?: string;
    };
  }>('/tags', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { name, color } = req.body;

    const tag = await crmService.createTag(tenantId, { name, color });

    return reply.send(tag);
  });

  /**
   * GET /crm/tags
   * Lista tags
   */
  fastify.get('/tags', async (req, reply) => {
    const tenantId = req.tenant!.id;

    const tags = await crmService.listTags(tenantId);

    return reply.send({ tags });
  });

  /**
   * POST /crm/contacts/:id/tags/:tagId
   * Atribui tag ao contato
   */
  fastify.post<{
    Params: { id: string; tagId: string };
  }>('/contacts/:id/tags/:tagId', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const contactId = req.params.id;
    const tagId = req.params.tagId;

    const actor = await resolveActiveActorFromRequest(req, tenantId, {
      allowUserFallback: true,
      userId: req.user?.id,
    });

    await crmService.assignTag(
      tenantId,
      contactId,
      tagId,
      actor.actor_id,
      req.user?.id || null
    );

    return reply.send({ success: true });
  });

  /**
   * DELETE /crm/contacts/:id/tags/:tagId
   * Remove tag do contato
   */
  fastify.delete<{
    Params: { id: string; tagId: string };
  }>('/contacts/:id/tags/:tagId', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const contactId = req.params.id;
    const tagId = req.params.tagId;

    const actor = await resolveActiveActorFromRequest(req, tenantId, {
      allowUserFallback: true,
      userId: req.user?.id,
    });

    await crmService.removeTag(
      tenantId,
      contactId,
      tagId,
      actor.actor_id,
      req.user?.id || null
    );

    return reply.send({ success: true });
  });

  /**
   * POST /crm/contacts/:id/consents
   * Define consentimento
   */
  fastify.post<{
    Params: { id: string };
    Body: {
      channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH';
      status: 'GRANTED' | 'REVOKED';
      metadata?: Record<string, any>;
    };
  }>('/contacts/:id/consents', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const contactId = req.params.id;
    const { channel, status, metadata } = req.body;

    const actor = await resolveActiveActorFromRequest(req, tenantId, {
      allowUserFallback: true,
      userId: req.user?.id,
    });

    const consent = await crmService.setConsent(
      tenantId,
      actor.actor_id,
      req.user?.id || null,
      {
        contactId,
        channel,
        status,
        metadata,
      }
    );

    return reply.send(consent);
  });

  /**
   * GET /crm/contacts/:id/consents
   * Lista consentimentos do contato
   */
  fastify.get<{ Params: { id: string } }>('/contacts/:id/consents', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const contactId = req.params.id;

    const consents = await crmService.getConsents(tenantId, contactId);

    return reply.send({ consents });
  });
};

export default crmRoutes;

