// src/core/profile/impact-overview.routes.ts
// Rotas para impacto passivo (read-only)
// 🔴 BLINDAGEM: Apenas leitura, não altera estado
// 🔴 BLINDAGEM: Não projeta futuro, não sugere ação
// 🔴 BLINDAGEM: Não usa palavras como "urgente", "risco", "perda"
// 🔴 BLINDAGEM: Apenas números e descrições neutras

import { FastifyPluginAsync } from 'fastify';
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { socialPortsRegistry } from '@core/social/ports-registry';

const impactOverviewRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /me/impact-overview
   * Impacto passivo do usuário (read-only)
   * 🔴 BLINDAGEM: Apenas leitura, não altera estado
   * 🔴 BLINDAGEM: Não projeta futuro, não sugere ação
   */
  fastify.get('/me/impact-overview', async (req, reply) => {
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

      // 🔴 DECISION-0113 fatia 6.3 (leitura cross-user): representabilidade ANTES de ler o overview de
      // impacto (eventos/grupos/bookings/valores) do actor declarado (spoofável) — fail-closed → 403 não-leak.
      let canReadImpact = false;
      try {
        const { authorizationService } = await import('@core/authorization/authorization.service');
        canReadImpact = await authorizationService.canRepresentActor(req.tenant.id, req.user.userId, req.actionContext.actorId);
      } catch { canReadImpact = false; }
      if (!canReadImpact) {
        return reply.status(403).send({ error: 'Actor não representável pelo usuário autenticado' });
      }

      const tenantId = req.tenant.id;
      const actorId = req.actionContext.actorId;
      const globalUserId = req.user!.id;
      const userId = req.user!.id;

      // Buscar actor do ActionContext
      const actorRepository = socialPortsRegistry.getActorRepository();
      const actor = await actorRepository.findById(tenantId, actorId);
      if (!actor) {
        return reply.status(404).send({ error: 'Actor não encontrado' });
      }

      // 1. Eventos afetados (eventos que o usuário organiza com status draft ou published que já passaram)
      const eventsAffectedRow = await runQueryWithTenant<{ count: string }>(
        tenantId,
        `
        SELECT COUNT(*)::text as count
        FROM events
        WHERE tenant_id = $1
          AND actor_id = $2
          AND (
            status = 'draft'
            OR (status = 'published' AND datetime_end < now())
          )
        `,
        // 🔴 F-PROFILE-READERS-BROKEN-COLUMNS-FIX: created_by_global_user_id (inexistente)→actor_id ·
        //    ends_at→datetime_end · 'completed'/'archived' fora do CHECK vivo de status.
        [tenantId, actor.actor_id]
      );
      const eventsAffected = eventsAffectedRow ? Number(eventsAffectedRow.count) : 0;

      // 2. Pessoas aguardando (participantes de eventos pendentes + membros de grupos inativos + bookings pendentes)
      // Participantes de eventos pendentes
      const peopleWaitingEventsRow = await runQueryWithTenant<{ count: string }>(
        tenantId,
        `
        SELECT COUNT(DISTINCT ea.global_user_id)::text as count
        FROM event_attendees ea
        INNER JOIN events e ON ea.event_id = e.id
        WHERE e.tenant_id = $1
          AND e.actor_id = $2
          AND (
            e.status = 'draft'
            OR (e.status = 'published' AND e.datetime_end < now())
          )
        `,
        // 🔴 F-PROFILE-READERS-BROKEN-COLUMNS-FIX: e.created_by_global_user_id→e.actor_id · e.ends_at→e.datetime_end.
        [tenantId, actor.actor_id]
      );
      const peopleWaitingEvents = peopleWaitingEventsRow ? Number(peopleWaitingEventsRow.count) : 0;

      // Membros de grupos inativos
      const peopleWaitingGroupsRow = await runQueryWithTenant<{ count: string }>(
        tenantId,
        `
        SELECT COUNT(DISTINCT gm.user_id)::text as count
        FROM group_members gm
        INNER JOIN groups g ON gm.group_id = g.id
        WHERE g.tenant_id = $1
          AND g.owner_actor_id = $2
          AND g.status = 'inactive'
        `,
        // 🔴 F-PROFILE-READERS-BROKEN-COLUMNS-FIX: groups PK id · dono vivo owner_actor_id ·
        //    is_active→status ('active'/'inactive', CHECK C36). Mesmo dono (grupos do actor representado).
        [tenantId, actor.actor_id]
      );
      const peopleWaitingGroups = peopleWaitingGroupsRow ? Number(peopleWaitingGroupsRow.count) : 0;

      // Bookings pendentes (requester_actor_id)
      const peopleWaitingBookingsRow = await runQueryWithTenant<{ count: string }>(
        tenantId,
        `
        SELECT COUNT(DISTINCT b.requester_actor_id)::text as count
        FROM bookings b
        INNER JOIN availability a ON b.availability_id = a.availability_id
        WHERE b.tenant_id = $1
          AND b.status = 'requested'
          AND (
            (a.owner_type = 'user' AND a.owner_id = $2)
            -- A2E (DECISION-0156 R5): ownership do prestador via SSOT canonico
            --    (service_offering -> provider_actor_id); eixo legado de servico removido.
            OR (a.owner_type = 'service_offering' AND EXISTS (
              SELECT 1 FROM service_offerings so
              WHERE so.id = a.owner_id
              AND so.provider_actor_id = $2
            ))
            -- F-PROFILE-READERS-BROKEN-COLUMNS-FIX: groups PK id · dono vivo owner_actor_id.
            OR (a.owner_type = 'group' AND EXISTS (
              SELECT 1 FROM groups g
              WHERE g.id = a.owner_id
              AND g.owner_actor_id = $2
            ))
          )
        `,
        [tenantId, actor.actor_id]
      );
      const peopleWaitingBookings = peopleWaitingBookingsRow ? Number(peopleWaitingBookingsRow.count) : 0;

      const peopleWaiting = peopleWaitingEvents + peopleWaitingGroups + peopleWaitingBookings;

      // 3. Valores bloqueados (pagamentos pendentes + bookings pendentes com valor estimado)
      // Pagamentos pendentes
      const moneyLockedPaymentsRow = await runQueryWithTenant<{ total: string }>(
        tenantId,
        `
        SELECT COALESCE(SUM(amount_cents), 0)::text as total
        FROM service_payment_requests
        WHERE tenant_id = $1
          AND payer_actor_id = $2
          AND payment_request_status = 'pending'
        `,
        [tenantId, actor.actor_id]
      );
      const moneyLockedPayments = moneyLockedPaymentsRow ? Number(moneyLockedPaymentsRow.total) : 0;

      // 🔴 F-IMPACT-OVERVIEW-MONEYLOCKED-CENTS-FIX (DT-IMPACT-OVERVIEW-MONEYLOCKED-CENTS-100X-INFLATION):
      // SUM(amount_cents) JÁ está em centavos (nomenclatura 07, pós rename amount→amount_cents). O
      // `* 100` legado (comentário "converter se necessário" partia da premissa antiga de valor inteiro)
      // inflava o display em 100×. moneyLockedCents = a soma direta. Display/read-model — NÃO escreve
      // bank_ledger (SSOT financeiro intocado; Δbank=0).
      const moneyLockedCents = moneyLockedPayments;

      // 4. Eventos em andamento (published ou ongoing)
      const ongoingEventsRow = await runQueryWithTenant<{ count: string }>(
        tenantId,
        `
        SELECT COUNT(*)::text as count
        FROM events
        WHERE tenant_id = $1
          AND actor_id = $2
          AND status IN ('published', 'active')
          AND datetime_start <= now()
          AND datetime_end >= now()
        `,
        // 🔴 F-PROFILE-READERS-BROKEN-COLUMNS-FIX: created_by_global_user_id→actor_id · starts_at/ends_at→
        //    datetime_start/datetime_end · 'ongoing' fora do CHECK vivo (em-andamento vivo = 'active').
        [tenantId, actor.actor_id]
      );
      const ongoingEvents = ongoingEventsRow ? Number(ongoingEventsRow.count) : 0;

      // 5. Grupos ativos
      const activeGroupsRow = await runQueryWithTenant<{ count: string }>(
        tenantId,
        `
        SELECT COUNT(*)::text as count
        FROM groups
        WHERE tenant_id = $1
          AND owner_actor_id = $2
          AND status = 'active'
        `,
        // 🔴 F-PROFILE-READERS-BROKEN-COLUMNS-FIX: dono vivo owner_actor_id · is_active→status.
        [tenantId, actor.actor_id]
      );
      const activeGroups = activeGroupsRow ? Number(activeGroupsRow.count) : 0;

      return reply.send({
        pendingImpact: {
          eventsAffected,
          peopleWaiting,
          moneyLockedCents,
        },
        neutralImpact: {
          ongoingEvents,
          activeGroups,
        },
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar impacto');
      return reply.status(500).send({ error: 'Erro ao buscar impacto' });
    }
  });
};

export default impactOverviewRoutes;



