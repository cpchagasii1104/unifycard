// src/modules/profile/commitments.routes.ts
// Rotas para painel "Meus Compromissos" (read-only)
// 🔴 BLINDAGEM: Apenas leitura, não altera estado
// 🔴 BLINDAGEM: Não prioriza, não ordena por "importância"
// 🔴 BLINDAGEM: Apenas ordena por tempo quando fizer sentido

import { FastifyPluginAsync } from 'fastify';
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { eventsService } from '@modules/events/events.service';
import { groupsService } from '@modules/groups/groups.service';
import { unifiedAvailabilityService } from '@core/availability/unified-availability.service';
import { socialInboxService } from '@modules/inbox/social-inbox.service';
import { socialPortsRegistry } from '@core/social/ports-registry';

const commitmentsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /me/commitments
   * Painel "Meus Compromissos" (read-only)
   * 🔴 BLINDAGEM: Apenas leitura, não altera estado
   * 🔴 BLINDAGEM: Não prioriza, não ordena por "importância"
   */
  fastify.get('/me/commitments', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      // ActionContext é obrigatório (V2)
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }

      const tenantId = req.tenant.id;
      const actorId = req.actionContext.actorId;
      const globalUserId = req.user.id;
      const userId = req.user.id;

      // 🔴 DECISION-0113 F6.5.1 (CRA): partes deste painel (bookings/inbox/economia, itens 4-6) são keyed
      // no `actor.actor_id` resolvido do `actionContext.actorId` declarado (spoofável) → sem gate, um caller
      // lê agenda/inbox/resumo econômico de OUTRO actor. O caller precisa poder REPRESENTAR esse actor.
      // Fail-closed → 403 não-leak (antes da existência: uniforme p/ alheio E inexistente).
      let canReadCommitments = false;
      try {
        const { authorizationService } = await import('@core/authorization/authorization.service');
        canReadCommitments = await authorizationService.canRepresentActor(tenantId, req.user.userId, actorId);
      } catch { canReadCommitments = false; }
      if (!canReadCommitments) {
        return reply.status(403).send({ error: 'Actor não representável pelo usuário autenticado' });
      }

      // Buscar actor do ActionContext
      const actorRepository = socialPortsRegistry.getActorRepository();
      const actor = await actorRepository.findById(tenantId, actorId);
      if (!actor) {
        return reply.status(404).send({ error: 'Actor não encontrado' });
      }

      // 1. Eventos que participo (event_attendees)
      const eventsParticipatingRows = await runQueriesWithTenant<{
        event_id: string;
        title: string;
        starts_at: Date;
        ends_at: Date;
        status: string;
        checked_in_at: Date | null;
      }>(
        tenantId,
        `
        SELECT 
          e.id as event_id,
          e.title,
          e.starts_at,
          e.ends_at,
          e.status,
          ea.checked_in_at
        FROM event_attendees ea
        JOIN events e ON ea.event_id = e.id
        WHERE ea.global_user_id = $1
          AND e.tenant_id = $2
          AND e.status IN ('published', 'ongoing')
        ORDER BY e.starts_at ASC
        LIMIT 20
        `,
        [globalUserId, tenantId]
      );

      const eventsParticipating = eventsParticipatingRows.map((row) => ({
        eventId: row.event_id,
        title: row.title,
        startTime: row.starts_at.toISOString(),
        endTime: row.ends_at.toISOString(),
        status: row.status,
        checkedIn: row.checked_in_at !== null,
      }));

      // 2. Eventos que organizo (created_by_global_user_id)
      const eventsOrganizingRows = await runQueriesWithTenant<{
        id: string;
        title: string;
        starts_at: Date;
        ends_at: Date;
        status: string;
      }>(
        tenantId,
        `
        SELECT id, title, starts_at, ends_at, status
        FROM events
        WHERE tenant_id = $1
          AND created_by_global_user_id = $2
          AND status IN ('draft', 'published', 'ongoing')
        ORDER BY starts_at ASC
        LIMIT 20
        `,
        [tenantId, globalUserId]
      );

      const eventsOrganizing = eventsOrganizingRows.map((row) => ({
        eventId: row.id,
        title: row.title,
        startTime: row.starts_at.toISOString(),
        endTime: row.ends_at.toISOString(),
        status: row.status,
      }));

      // 3. Grupos que gerencio (ownerUserId)
      // 🔴 NOTA: owner_user_id pode ser userId ou globalUserId dependendo do contexto
      // Tentar ambos para garantir compatibilidade
      const groupsManagingRows = await runQueriesWithTenant<{
        group_id: string;
        name: string;
        is_active: boolean;
        created_at: Date;
      }>(
        tenantId,
        `
        SELECT group_id, name, is_active, created_at
        FROM groups
        WHERE tenant_id = $1
          AND (owner_user_id = $2 OR owner_user_id = $3)
          AND is_active = true
        ORDER BY created_at DESC
        LIMIT 20
        `,
        [tenantId, userId, globalUserId]
      );

      const groupsManaging = groupsManagingRows.map((row) => ({
        groupId: row.group_id,
        name: row.name,
        isActive: row.is_active,
        createdAt: row.created_at,
      }));

      // 4. Agenda (bookings) - próximos compromissos
      const bookingsRows = await runQueriesWithTenant<{
        booking_id: string;
        availability_id: string;
        status: string;
        requestedAt: Date;
        start_datetime: Date;
        end_datetime: Date;
      }>(
        tenantId,
        `
        SELECT 
          b.booking_id,
          b.availability_id,
          b.status,
          b.requestedAt,
          a.start_datetime,
          a.end_datetime
        FROM bookings b
        JOIN availability a ON b.availability_id = a.availability_id
        WHERE b.tenant_id = $1
          AND b.requester_actor_id = $2
          AND b.status IN ('confirmed', 'pending')
          AND a.start_datetime >= now()
        ORDER BY a.start_datetime ASC
        LIMIT 20
        `,
        [tenantId, actor.actor_id]
      );

      const agendaBookings = bookingsRows.map((row) => ({
        bookingId: row.booking_id,
        availabilityId: row.availability_id,
        status: row.status,
        requestedAt: row.requestedAt.toISOString(),
        startDatetime: row.start_datetime.toISOString(),
        endDatetime: row.end_datetime.toISOString(),
      }));

      // 5. Contador de inbox pendente
      let inboxPendingCount = 0;
      try {
        const inboxCounter = await socialInboxService.getInboxCounter(tenantId, actor.actor_id);
        inboxPendingCount = inboxCounter.unreadCount || 0;
      } catch (err) {
        // Não bloquear se inbox falhar
        fastify.log.warn({ err }, 'Erro ao buscar contador de inbox');
      }

      // 6. Resumo econômico (read-only)
      let economySummary = {
        totalInvolved: 0,
        totalSpent: 0,
        totalReceived: 0,
      };
      try {
        const { economicOverviewProjector } = await import('@modules/economy/economic-overview.projector');
        const overview = await economicOverviewProjector.projectActorEconomicOverview(tenantId, actor.actor_id);
        
        economySummary = {
          totalInvolved: overview.executionsCount,
          totalSpent: overview.totalPaid,
          totalReceived: overview.totalReceived,
        };
      } catch (err) {
        // Não bloquear se economia falhar
        fastify.log.warn({ err }, 'Erro ao buscar resumo econômico');
      }

      return reply.send({
        eventsParticipating,
        eventsOrganizing,
        groupsManaging,
        agendaBookings,
        inboxPendingCount,
        economySummary,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar compromissos');
      return reply.status(500).send({ error: 'Erro ao buscar compromissos' });
    }
  });
};

export default commitmentsRoutes;









