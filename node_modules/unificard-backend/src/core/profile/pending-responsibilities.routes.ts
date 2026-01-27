// src/core/profile/pending-responsibilities.routes.ts
// Rotas para pendências (read-only)
// 🔴 BLINDAGEM: Apenas leitura, não altera estado
// 🔴 BLINDAGEM: Não prioriza, não ordena por "importância"
// 🔴 BLINDAGEM: Apenas ordena por data quando fizer sentido

import { FastifyPluginAsync } from 'fastify';
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { socialPortsRegistry } from '@core/social/ports-registry';

const pendingResponsibilitiesRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /me/pending-responsibilities
   * Pendências reais do usuário (read-only)
   * 🔴 BLINDAGEM: Apenas leitura, não altera estado
   * 🔴 BLINDAGEM: Não prioriza, não ordena por "importância"
   */
  fastify.get('/me/pending-responsibilities', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const tenantId = req.tenant.id;
      const globalUserId = req.user.globalUserId || req.user.id;
      const userId = req.user.userId || req.user.id;
      
      // Buscar actor do usuário
      const actorRepository = socialPortsRegistry.getActorRepository();
      const actor = await actorRepository.findOrCreateUserActor(tenantId, userId);
      if (!actor) {
        return reply.status(404).send({ error: 'Actor não encontrado' });
      }

      // 1. Eventos pendentes (draft ou published que já passaram mas não foram finalizados)
      const pendingEventsRows = await runQueriesWithTenant<{
        id: string;
        title: string;
        status: string;
        start_time: Date;
        end_time: Date;
        created_at: Date;
      }>(
        tenantId,
        `
        SELECT id, title, status, start_time, end_time, created_at
        FROM events
        WHERE tenant_id = $1
          AND created_by_global_user_id = $2
          AND (
            status = 'draft'
            OR (status = 'published' AND end_time < now() AND status != 'completed' AND status != 'archived')
          )
        ORDER BY created_at DESC
        LIMIT 20
        `,
        [tenantId, globalUserId]
      );

      const pendingEvents = pendingEventsRows.map((row) => ({
        id: row.id,
        title: row.title,
        type: 'event',
        status: row.status,
        startTime: row.start_time.toISOString(),
        endTime: row.end_time.toISOString(),
        createdAt: row.created_at.toISOString(),
      }));

      // 2. Grupos pendentes (inativos ou sem finalidade financeira se tem intenção financeira)
      const pendingGroupsRows = await runQueriesWithTenant<{
        group_id: string;
        name: string;
        is_active: boolean;
        has_financial_intent: boolean;
        financial_purpose: string | null;
        created_at: Date;
      }>(
        tenantId,
        `
        SELECT 
          group_id, 
          name, 
          is_active, 
          COALESCE((metadata->>'hasFinancialIntent')::boolean, false) as has_financial_intent,
          financial_purpose,
          created_at
        FROM groups
        WHERE tenant_id = $1
          AND (owner_user_id = $2 OR owner_user_id = $3)
          AND (
            is_active = false
            OR (
              COALESCE((metadata->>'hasFinancialIntent')::boolean, false) = true
              AND (financial_purpose IS NULL OR financial_purpose = '')
            )
          )
        ORDER BY created_at DESC
        LIMIT 20
        `,
        [tenantId, userId, globalUserId]
      );

      const pendingGroups = pendingGroupsRows.map((row) => ({
        id: row.group_id,
        name: row.name,
        type: 'group',
        status: row.is_active ? 'active' : 'inactive',
        needsFinancialPurpose: row.has_financial_intent && (!row.financial_purpose || row.financial_purpose === ''),
        createdAt: row.created_at.toISOString(),
      }));

      // 3. Serviços com solicitações pendentes (bookings em status 'requested')
      const pendingServicesRows = await runQueriesWithTenant<{
        service_id: string;
        title: string;
        status: string;
        booking_count: number;
        created_at: Date;
      }>(
        tenantId,
        `
        SELECT 
          s.service_id,
          s.title,
          s.status,
          COUNT(b.booking_id) as booking_count,
          MAX(s.created_at) as created_at
        FROM services s
        INNER JOIN availability a ON a.owner_type = 'service' AND a.owner_id = s.service_id
        INNER JOIN bookings b ON b.availability_id = a.availability_id AND b.status = 'requested'
        WHERE s.tenant_id = $1
          AND s.owner_actor_id = $2
        GROUP BY s.service_id, s.title, s.status, s.created_at
        HAVING COUNT(b.booking_id) > 0
        ORDER BY MAX(s.created_at) DESC
        LIMIT 20
        `,
        [tenantId, actor.actor_id]
      );

      const pendingServices = pendingServicesRows.map((row) => ({
        id: row.service_id,
        title: row.title,
        type: 'service',
        status: row.status,
        pendingBookingsCount: Number(row.booking_count),
        createdAt: row.created_at.toISOString(),
      }));

      // 4. Pagamentos aguardando confirmação (payment_requests com status 'pending')
      const pendingPaymentsRows = await runQueriesWithTenant<{
        payment_request_id: string;
        amount: number;
        currency: string;
        status: string;
        requested_at: Date;
        service_id: string | null;
        booking_id: string | null;
      }>(
        tenantId,
        `
        SELECT 
          pr.payment_request_id,
          pr.amount,
          pr.currency,
          pr.status,
          pr.requested_at,
          pr.service_id,
          pr.booking_id
        FROM service_payment_requests pr
        WHERE pr.tenant_id = $1
          AND pr.payer_actor_id = $2
          AND pr.status = 'pending'
        ORDER BY pr.requested_at DESC
        LIMIT 20
        `,
        [tenantId, actor.actor_id]
      );

      const pendingPayments = pendingPaymentsRows.map((row) => ({
        id: row.payment_request_id,
        type: 'payment',
        status: row.status,
        amount: parseFloat(row.amount.toString()),
        currency: row.currency,
        serviceId: row.service_id,
        bookingId: row.booking_id,
        requestedAt: row.requested_at.toISOString(),
      }));

      // 5. Bookings aguardando resposta (status 'requested' onde o usuário é owner da availability)
      const pendingBookingsRows = await runQueriesWithTenant<{
        booking_id: string;
        availability_id: string;
        requester_actor_id: string;
        status: string;
        requested_at: Date;
        owner_type: string;
        owner_id: string;
        start_datetime: Date;
        end_datetime: Date;
      }>(
        tenantId,
        `
        SELECT 
          b.booking_id,
          b.availability_id,
          b.requester_actor_id,
          b.status,
          b.requested_at,
          a.owner_type,
          a.owner_id,
          a.start_datetime,
          a.end_datetime
        FROM bookings b
        INNER JOIN availability a ON b.availability_id = a.availability_id
        WHERE b.tenant_id = $1
          AND b.status = 'requested'
          AND (
            (a.owner_type = 'user' AND a.owner_id = $2)
            OR (a.owner_type = 'service' AND EXISTS (
              SELECT 1 FROM services s 
              WHERE s.service_id = a.owner_id 
              AND s.owner_actor_id = $2
            ))
            OR (a.owner_type = 'group' AND EXISTS (
              SELECT 1 FROM groups g 
              WHERE g.group_id = a.owner_id 
              AND (g.owner_user_id = $3 OR g.owner_user_id = $4)
            ))
          )
        ORDER BY b.requested_at DESC
        LIMIT 20
        `,
        [tenantId, actor.actor_id, userId, globalUserId]
      );

      const pendingBookings = pendingBookingsRows.map((row) => ({
        id: row.booking_id,
        availabilityId: row.availability_id,
        type: 'booking',
        status: row.status,
        requesterActorId: row.requester_actor_id,
        ownerType: row.owner_type,
        ownerId: row.owner_id,
        startDatetime: row.start_datetime.toISOString(),
        endDatetime: row.end_datetime.toISOString(),
        requestedAt: row.requested_at.toISOString(),
      }));

      return reply.send({
        pendingEvents,
        pendingGroups,
        pendingServices,
        pendingPayments,
        pendingBookings,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar pendências');
      return reply.status(500).send({ error: 'Erro ao buscar pendências' });
    }
  });
};

export default pendingResponsibilitiesRoutes;

