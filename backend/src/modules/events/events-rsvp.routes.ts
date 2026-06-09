// backend/src/modules/events/events-rsvp.routes.ts
// Rotas para RSVP (confirmação de presença) em eventos
// ⚠️ REGRAS CANÔNICAS:
// - RSVP só acontece após clique explícito
// - RSVP NÃO altera visibilidade
// - RSVP NÃO dispara ações automáticas
// - RSVP é reversível

import { FastifyPluginAsync } from 'fastify';
import { eventRSVPService } from '@core/events/event-rsvp.service';
import { eventActionsService } from '@core/events/event-actions.service';
import type { CreateRSVPInput, RSVPStatus } from '@core/events/event-rsvp.service';

const eventsRSVPRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /events/:id/rsvp
   * Cria ou atualiza RSVP
   */
  fastify.post<{
    Params: { id: string };
    Body: {
      status: RSVPStatus;
      notes?: string | null;
      guest_email?: string | null;
      guest_name?: string | null;
    };
  }>('/:id/rsvp', async (request, reply) => {
    const { id: eventId } = request.params;
    const { status, notes, guest_email, guest_name } = request.body;
    const tenantId = (request as any).tenant_id;
    const userId = (request as any).user_id;

    if (!tenantId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Validar status
    if (!['yes', 'no', 'maybe'].includes(status)) {
      return reply.code(400).send({ error: 'Status inválido. Deve ser: yes, no ou maybe' });
    }

    try {
      const input: CreateRSVPInput = {
        event_id: eventId,
        user_id: userId || null,
        guest_email: guest_email || null,
        guest_name: guest_name || null,
        status,
        notes: notes || null,
      };

      const rsvp = await eventRSVPService.upsertRSVP(tenantId, userId || null, input);

      // Logar ação (observabilidade passiva)
      await eventActionsService.logAction(tenantId, {
        event_id: eventId,
        user_id: userId || null,
        action_type: `rsvp_${status}` as any,
        metadata: {
          rsvp_id: rsvp.id,
          guest_email: guest_email || null,
        },
      });

      return { rsvp };
    } catch (error: any) {
      if (error.status) {
        return reply.code(error.status).send({ error: error.message });
      }
      return reply.code(500).send({ error: error.message || 'Erro ao criar/atualizar RSVP' });
    }
  });

  /**
   * GET /events/:id/rsvp/status
   * Busca status de RSVP do usuário para o evento
   */
  fastify.get<{
    Params: { id: string };
    Querystring: { guest_email?: string };
  }>('/:id/rsvp/status', async (request, reply) => {
    const { id: eventId } = request.params;
    const { guest_email } = request.query;
    const tenantId = (request as any).tenant_id;
    const userId = (request as any).user_id;

    if (!tenantId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // 🔵 DECISION-0113 F6.5.6b-CANAL5-B: sub-resource herda canViewEvent do evento-pai (404 não-leak).
    const { canViewEvent } = await import('@core/events/event-visibility.service');
    if (!(await canViewEvent(tenantId, eventId, userId))) {
      return reply.code(404).send({ error: 'Evento não encontrado' });
    }

    try {
      const rsvp = await eventRSVPService.getRSVPStatus(
        tenantId,
        eventId,
        userId || null,
        guest_email || null
      );

      if (!rsvp) {
        return reply.code(404).send({ error: 'RSVP não encontrado' });
      }

      return { rsvp };
    } catch (error: any) {
      if (error.status) {
        return reply.code(error.status).send({ error: error.message });
      }
      return reply.code(500).send({ error: error.message || 'Erro ao buscar RSVP' });
    }
  });

  /**
   * GET /events/:id/rsvp/counts
   * Busca contagens de RSVP para o evento
   */
  fastify.get<{
    Params: { id: string };
  }>('/:id/rsvp/counts', async (request, reply) => {
    const { id: eventId } = request.params;
    const tenantId = (request as any).tenant_id;
    const userId = (request as any).user_id;

    if (!tenantId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // 🔵 DECISION-0113 F6.5.6b-CANAL5-B: sub-resource herda canViewEvent do evento-pai (404 não-leak).
    const { canViewEvent } = await import('@core/events/event-visibility.service');
    if (!(await canViewEvent(tenantId, eventId, userId))) {
      return reply.code(404).send({ error: 'Evento não encontrado' });
    }

    try {
      const counts = await eventRSVPService.getRSVPCounts(tenantId, eventId);
      return { counts };
    } catch (error: any) {
      if (error.status) {
        return reply.code(error.status).send({ error: error.message });
      }
      return reply.code(500).send({ error: error.message || 'Erro ao buscar contagens de RSVP' });
    }
  });

  /**
   * DELETE /events/:id/rsvp
   * Remove RSVP
   */
  fastify.delete<{
    Params: { id: string };
    Querystring: { guest_email?: string };
  }>('/:id/rsvp', async (request, reply) => {
    const { id: eventId } = request.params;
    const { guest_email } = request.query;
    const tenantId = (request as any).tenant_id;
    const userId = (request as any).user_id;

    if (!tenantId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      await eventRSVPService.removeRSVP(
        tenantId,
        eventId,
        userId || null,
        guest_email || null
      );

      return { success: true };
    } catch (error: any) {
      if (error.status) {
        return reply.code(error.status).send({ error: error.message });
      }
      return reply.code(500).send({ error: error.message || 'Erro ao remover RSVP' });
    }
  });
};

export { eventsRSVPRoutes };


