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
        datetime_start: Date | null;
        datetime_end: Date | null;
        status: string;
        checked_in_at: Date | null;
      }>(
        tenantId,
        `
        -- 2026-08-04 - colunas e vocabulario MEDIDOS, nao deduzidos:
        --   events NAO tem starts_at/ends_at -> datetime_start/datetime_end
        --   events.status CHECK = draft/declared/published/active/ended/cancelled
        --   "ongoing" NAO EXISTE (era do desenho antigo, ver migrations_archive)
        SELECT
          e.id as event_id,
          e.title,
          e.datetime_start,
          e.datetime_end,
          e.status,
          ea.checked_in_at
        FROM event_attendees ea
        JOIN events e ON ea.event_id = e.id
        WHERE ea.global_user_id = $1
          AND e.tenant_id = $2
          AND e.status IN ('published', 'active')
        ORDER BY e.datetime_start ASC
        LIMIT 20
        `,
        [globalUserId, tenantId]
      );

      const eventsParticipating = eventsParticipatingRows.map((row) => ({
        eventId: row.event_id,
        title: row.title,
        // Data NULA e possivel (evento declarado sem agenda confirmada): devolve null, nunca
        // uma data inventada — e nunca estoura .toISOString() de undefined.
        startTime: row.datetime_start ? row.datetime_start.toISOString() : null,
        endTime: row.datetime_end ? row.datetime_end.toISOString() : null,
        status: row.status,
        checkedIn: row.checked_in_at !== null,
      }));

      // 2. Eventos que organizo (created_by_global_user_id)
      const eventsOrganizingRows = await runQueriesWithTenant<{
        id: string;
        title: string;
        datetime_start: Date | null;
        datetime_end: Date | null;
        status: string;
      }>(
        tenantId,
        `
        -- 2026-08-04 - created_by_global_user_id NAO EXISTE em events. O dono e o ACTOR
        -- (events.actor_id), que e como todo o resto do dominio de eventos ja resolve organizador
        -- (event.service.ts / listOrganizerEvents). Por isso o parametro passou a ser o actor.
        SELECT id, title, datetime_start, datetime_end, status
        FROM events
        WHERE tenant_id = $1
          AND actor_id = $2
          AND status IN ('draft', 'declared', 'published', 'active')
        ORDER BY datetime_start ASC NULLS LAST
        LIMIT 20
        `,
        [tenantId, actor.actor_id]
      );

      const eventsOrganizing = eventsOrganizingRows.map((row) => ({
        eventId: row.id,
        title: row.title,
        startTime: row.datetime_start ? row.datetime_start.toISOString() : null,
        endTime: row.datetime_end ? row.datetime_end.toISOString() : null,
        status: row.status,
      }));

      // 3. Grupos que gerencio (ownerUserId)
      // 🔴 NOTA: owner_user_id pode ser userId ou globalUserId dependendo do contexto
      // Tentar ambos para garantir compatibilidade
      const groupsManagingRows = await runQueriesWithTenant<{
        id: string;
        name: string;
        status: string;
        created_at: Date;
      }>(
        tenantId,
        `
        -- 2026-08-04 - MEDIDO: groups nao tem group_id/is_active/owner_user_id. As colunas reais
        -- sao id / status / owner_actor_id. Dono de grupo e ACTOR (owner_actor_id), coerente com
        -- CONTRATO_GRUPOS_V2 e com o resto do dominio; o par userId/globalUserId aqui era chute.
        SELECT id, name, status, created_at
        FROM groups
        WHERE tenant_id = $1
          AND owner_actor_id = $2
          AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 20
        `,
        [tenantId, actor.actor_id]
      );

      const groupsManaging = groupsManagingRows.map((row) => ({
        groupId: row.id,
        name: row.name,
        isActive: row.status === 'active',
        createdAt: row.created_at,
      }));

      // 🔴 O MOTOR DO `expired` (2026-08-04). O estado e a coluna `expired_at` existiam e NADA os
      // acionava: pedido que o fornecedor nunca respondesse ficava `requested` para sempre — cliente
      // esperando sem prazo, horário pendurado. Achado da instância de ARQUITETURA, confirmado por
      // mim, e ele cai justamente sobre o fluxo de pedido que EU entreguei hoje.
      //
      // O caller é AQUI de propósito: este painel é onde os DOIS lados olham seus pedidos pendentes.
      // Um worker novo seria mais uma peça sem quem lhe dê partida — `startIdempotencyCleanupWorker`
      // já existe com zero callers, e é a mesma doença com outro nome.
      //
      // Não bloqueia a leitura: se expirar falhar, o painel ainda deve abrir. Mas o erro APARECE —
      // catch silencioso aqui seria trocar um estado errado por um estado errado E invisível.
      try {
        const { expirePastDueBookings } = await import('@core/availability/booking-expiry.service');
        const { expirados } = await expirePastDueBookings(tenantId);
        if (expirados > 0) fastify.log.info({ tenantId, expirados }, 'pedidos vencidos expirados');
      } catch (err) {
        fastify.log.error({ err, tenantId }, 'falha ao expirar pedidos vencidos (painel segue)');
      }

      // 4. Agenda (bookings) - próximos compromissos
      const bookingsRows = await runQueriesWithTenant<{
        booking_id: string;
        availability_id: string;
        status: string;
        requested_at: Date;
        notes: string | null;
        start_datetime: Date;
        end_datetime: Date;
      }>(
        tenantId,
        `
        -- 2026-08-04 - ESTA ROTA DEVOLVIA 500 E NINGUEM SABIA. Dois defeitos empilhados, ambos
        -- medidos antes de tocar em nada (sem crase: isto vive dentro de template literal JS).
        --
        --  1. b.requestedAt SEM ASPAS: o Postgres dobra para requestedat, e a coluna e
        --     requested_at -> 42703. A pagina "Meus compromissos" NUNCA carregou.
        --     Comando: SELECT column_name FROM information_schema.columns
        --              WHERE table_name = bookings AND column_name ILIKE %request%;
        --              -> requester_actor_id, requested_at
        --
        --  2. status IN (confirmed, pending) -> "pending" NAO EXISTE no vocabulario.
        --     O CHECK fisico diz: requested/confirmed/cancelled/expired/checked_in/checked_out.
        --     Comando: SELECT pg_get_constraintdef(oid) FROM pg_constraint
        --              WHERE conrelid = bookings::regclass AND contype = c;
        --     "requested" e justamente o estado em que TODO pedido nasce (oferta em modo manual
        --     negocia). Ou seja: mesmo com o 500 consertado o pedido seguiria invisivel - o
        --     defeito MUDO por baixo do defeito barulhento.
        SELECT
          b.booking_id,
          b.availability_id,
          b.status,
          b.requested_at,
          b.notes,
          a.start_datetime,
          a.end_datetime
        FROM bookings b
        JOIN availability a ON b.availability_id = a.availability_id
        WHERE b.tenant_id = $1
          AND b.requester_actor_id = $2
          AND b.status IN ('requested', 'confirmed', 'checked_in')
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
        requestedAt: row.requested_at.toISOString(),
        /** A mensagem de quem pediu. Sem ela o pedido chega mudo (ver `incomingRequests` abaixo). */
        notes: row.notes,
        startDatetime: row.start_datetime.toISOString(),
        endDatetime: row.end_datetime.toISOString(),
      }));

      // 4b. 🔴 O LADO QUE NÃO EXISTIA — PEDIDOS RECEBIDOS (2026-08-04).
      //
      // A consulta acima filtra `b.requester_actor_id = actor` — é a agenda de quem PEDE. Não havia
      // NENHUMA superfície do lado de quem RECEBE. Consequência concreta: religar `bookings.notes`
      // em `requestBooking` no mesmo dia teria entregue a mensagem a uma coluna que nenhuma tela
      // lia. Pedido de orçamento que ninguém vê não é pedido — é beco.
      //
      // O provider é DERIVADO da posse da janela (nunca informado pelo cliente): `availability`
      // aponta `owner_type`+`owner_id`, e daí sai `service_offerings.provider_actor_id` ou
      // `rentable_resources.owner_actor_id`. Os dois substratos, porque contratar e alugar são
      // caminhos diferentes e ambos desembocam em `bookings`.
      //
      // READ-ONLY · Δbank=0 · não decide nada: aceitar/recusar continua sendo ato do dono pelo
      // caminho selado (`updateBooking` → chokepoint único de confirm).
      const incomingRows = await runQueriesWithTenant<{
        booking_id: string; availability_id: string; status: string;
        requested_at: Date; notes: string | null;
        start_datetime: Date; end_datetime: Date;
        requester_actor_id: string; requester_display_name: string | null;
        offer_label: string | null;
      }>(
        tenantId,
        `
        SELECT b.booking_id, b.availability_id, b.status, b.requested_at, b.notes,
               av.start_datetime, av.end_datetime,
               b.requester_actor_id::text AS requester_actor_id,
               ra.display_name AS requester_display_name,
               COALESCE(cs.name, rr.label) AS offer_label
          FROM bookings b
          JOIN availability av ON av.availability_id = b.availability_id
          LEFT JOIN service_offerings so
                 ON av.owner_type = 'service_offering' AND so.id = av.owner_id
          LEFT JOIN canonical_services cs ON cs.id = so.canonical_service_id
          LEFT JOIN rentable_resources rr
                 ON av.owner_type = 'rentable_resource' AND rr.id = av.owner_id
          LEFT JOIN actors ra ON ra.id = b.requester_actor_id AND ra.tenant_id = $1
         WHERE b.tenant_id = $1
           AND COALESCE(so.provider_actor_id, rr.owner_actor_id) = $2
           AND b.status IN ('requested', 'confirmed')
           AND av.start_datetime >= now()
         ORDER BY (b.status = 'requested') DESC, av.start_datetime ASC
         LIMIT 20
        `,
        [tenantId, actor.actor_id]
      );

      const incomingRequests = incomingRows.map((row) => ({
        bookingId: row.booking_id,
        availabilityId: row.availability_id,
        status: row.status,
        requestedAt: row.requested_at.toISOString(),
        notes: row.notes,
        startDatetime: row.start_datetime.toISOString(),
        endDatetime: row.end_datetime.toISOString(),
        requesterActorId: row.requester_actor_id,
        requesterDisplayName: row.requester_display_name,
        offerLabel: row.offer_label,
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
        incomingRequests,
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









