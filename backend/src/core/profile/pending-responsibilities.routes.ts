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
      // ActionContext é obrigatório (V2)
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }

      // 🔴 DECISION-0113 fatia 6.3 (leitura cross-user): representabilidade ANTES de ler pendências
      // (eventos/grupos/bookings/pagamentos) do actor declarado (spoofável) — fail-closed → 403 não-leak.
      let canReadPending = false;
      try {
        const { authorizationService } = await import('@core/authorization/authorization.service');
        canReadPending = await authorizationService.canRepresentActor(req.tenant.id, req.user.userId, req.actionContext.actorId);
      } catch { canReadPending = false; }
      if (!canReadPending) {
        return reply.status(403).send({ error: 'Actor não representável pelo usuário autenticado' });
      }

      const tenantId = req.tenant.id;
      const actorId = req.actionContext.actorId;

      // Buscar actor do ActionContext
      const actorRepository = socialPortsRegistry.getActorRepository();
      const actor = await actorRepository.findById(tenantId, actorId);
      if (!actor) {
        return reply.status(404).send({ error: 'Actor não encontrado' });
      }
      
      // 🔴 A CAIXA DE ENTRADA RECUSAVA EMPRESA — e a trava não protegia nada (2026-08-05).
      //
      // Estas linhas exigiam `actor.user_id` e devolviam 404 "Actor não é do tipo user". Actor de
      // empresa tem `user_id NULL` por desenho (a autoridade dele vem de `company_users`), então a
      // Rio Verde — dona de 3 itens locáveis — não conseguia ver UM pedido sequer. Medido com curl
      // antes de mexer: 404 para a empresa, 200 para a pessoa.
      //
      // A trava era vestigial: `globalUserId` era calculado e NUNCA lido, e `userId` não aparecia em
      // consulta nenhuma depois daqui — TODAS já filtram por `actor.actor_id`. Ou seja, ela não
      // defendia nada; só recortava metade dos donos possíveis.
      //
      // A autoridade continua exatamente onde estava: `canRepresentActor` acima, que já provou que
      // este usuário representa este actor (e para empresa isso resolve por company_users). Remover
      // a trava NÃO amplia acesso — devolve o acesso que a autoridade já havia concedido.
      //
      // Clayton, no mesmo dia: *"a gente só pensa do lado de quem está fazendo aquela situação, mas
      // não pensa do outro lado"*. Esta rota é o caso exemplar: nasceu para as pendências de uma
      // PESSOA e nunca foi olhada do lado de quem RECEBE — que é empresa quase sempre.

      // 1. Eventos pendentes (draft ou published que já passaram mas não foram finalizados)
      const pendingEventsRows = await runQueriesWithTenant<{
        id: string;
        title: string;
        status: string;
        starts_at: Date | null;
        ends_at: Date | null;
        created_at: Date;
      }>(
        tenantId,
        // 🔴 F-PROFILE-READERS-BROKEN-COLUMNS-FIX: colunas mortas mapeadas p/ o schema vivo de events
        //    (20260525100000): created_by_global_user_id (inexistente)→actor_id (organizer actor-first) ·
        //    starts_at/ends_at→datetime_start/datetime_end (nullable; alias preserva contrato) ·
        //    'completed'/'archived' não existem no CHECK de status (lifecycle vivo: draft/declared/published/
        //    active/ended/cancelled) — predicado equivalente sem os valores mortos.
        `
        SELECT id, title, status, datetime_start AS starts_at, datetime_end AS ends_at, created_at
        FROM events
        WHERE tenant_id = $1
          AND actor_id = $2
          AND (
            status = 'draft'
            OR (status = 'published' AND datetime_end < now())
          )
        ORDER BY created_at DESC
        LIMIT 20
        `,
        [tenantId, actor.actor_id]
      );

      const pendingEvents = pendingEventsRows.map((row) => ({
        id: row.id,
        title: row.title,
        type: 'event',
        status: row.status,
        startTime: row.starts_at ? row.starts_at.toISOString() : null,
        endTime: row.ends_at ? row.ends_at.toISOString() : null,
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
        // 🔴 F-PROFILE-READERS-BROKEN-COLUMNS-FIX (DT-PROFILE-PENDING-IMPACT-READERS-BROKEN-COLUMNS):
        //    colunas mortas mapeadas p/ o schema vivo de groups (20260530180000 + C36 + COE-2):
        //    group_id→id AS group_id · is_active→status IN ('active','inactive') · financial_purpose→
        //    metadata->>'financialPurpose' · owner_user_id (inexistente)→owner_actor_id (âncora civil viva).
        //    Contrato da resposta preservado; mesmo dono (grupo do actor representado).
        `
        SELECT
          id AS group_id,
          name,
          (status = 'active') AS is_active,
          COALESCE((metadata->>'hasFinancialIntent')::boolean, false) as has_financial_intent,
          NULLIF(metadata->>'financialPurpose', '') AS financial_purpose,
          created_at
        FROM groups
        WHERE tenant_id = $1
          AND owner_actor_id = $2
          AND (
            status = 'inactive'
            OR (
              COALESCE((metadata->>'hasFinancialIntent')::boolean, false) = true
              AND COALESCE(metadata->>'financialPurpose', '') = ''
            )
          )
        ORDER BY created_at DESC
        LIMIT 20
        `,
        [tenantId, actor.actor_id]
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
        // 🔴 F-SERVICE-AVAILABILITY-PROVIDER-READERS-CONTAINMENT-SLICE-A2E (DECISION-0156 /
        //    DT-SERVICE-AVAILABILITY-RUNTIME-DRIFT-FROM-SSOT R4): a contagem de pendências do prestador resolve
        //    pelo SSOT canônico — availability owner_type='service_offering' → service_offerings.provider_actor_id
        //    — NUNCA pelo escopo legado owner_type='service'→services.owner_actor_id (coluna INEXISTENTE:
        //    services tem actor_id/name, não owner_actor_id/title → a query legada quebrava). Correção local
        //    obrigatória: s.owner_actor_id→s.actor_id, s.title→s.name.
        `
        SELECT
          s.service_id,
          s.name AS title,
          s.status,
          COUNT(b.booking_id) as booking_count,
          MAX(s.created_at) as created_at
        FROM services s
        INNER JOIN service_offerings so ON so.provider_actor_id = $2
          AND (so.service_id = s.service_id OR so.canonical_service_id = s.canonical_service_id)
        INNER JOIN availability a ON a.owner_type = 'service_offering' AND a.owner_id = so.id
        INNER JOIN bookings b ON b.availability_id = a.availability_id AND b.status = 'requested'
        WHERE s.tenant_id = $1
          AND s.actor_id = $2
        GROUP BY s.service_id, s.name, s.status, s.created_at
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
        amountCents: number;
        currency: string;
        status: string;
        requestedAt: Date;
        service_id: string | null;
        booking_id: string | null;
      }>(
        tenantId,
        `
        SELECT
          pr.payment_request_id,
          pr.amount_cents AS "amountCents",
          pr.currency,
          pr.payment_request_status AS status,
          pr.requested_at AS "requestedAt",
          pr.service_id,
          pr.booking_id
        FROM service_payment_requests pr
        WHERE pr.tenant_id = $1
          AND pr.payer_actor_id = $2
          AND pr.payment_request_status = 'pending'
        ORDER BY pr.requested_at DESC
        LIMIT 20
        `,
        [tenantId, actor.actor_id]
      );

      const pendingPayments = pendingPaymentsRows.map((row) => ({
        id: row.payment_request_id,
        type: 'payment',
        status: row.status,
        amountCents: row.amountCents,
        currency: row.currency,
        serviceId: row.service_id,
        bookingId: row.booking_id,
        requestedAt: row.requestedAt.toISOString(),
      }));

      // 5. Bookings aguardando resposta (status 'requested' onde o usuário é owner da availability)
      const pendingBookingsRows = await runQueriesWithTenant<{
        booking_id: string;
        availability_id: string;
        requester_actor_id: string;
        status: string;
        requestedAt: Date;
        owner_type: string;
        owner_id: string;
        start_datetime: Date;
        end_datetime: Date;
        notes: string | null;
        event_id: string | null;
        event_title: string | null;
        requester_display_name: string | null;
        requester_since: Date | null;
        requester_commitments: number;
      }>(
        tenantId,
        `
        SELECT
          b.booking_id,
          b.availability_id,
          b.requester_actor_id,
          b.status,
          b.requested_at AS "requestedAt",
          -- O CONTEXTO PARA DECIDIR: notes era gravado desde sempre e nunca lido; o evento passou a
          -- viajar hoje. Juntos respondem "para que isto vai", que e a pergunta do lado que aceita.
          b.notes,
          (b.metadata->>'eventId') AS event_id,
          ev.title AS event_title,
          -- QUEM PEDE, no minimo honesto. Reputacao fica FORA: 5 substratos, 0 linhas medidas.
          ra.display_name AS requester_display_name,
          ra.created_at   AS requester_since,
          (SELECT count(*)::int FROM bookings hb
            WHERE hb.tenant_id = b.tenant_id
              AND hb.requester_actor_id = b.requester_actor_id
              AND hb.status IN ('confirmed','checked_in','checked_out')) AS requester_commitments,
          a.owner_type,
          a.owner_id,
          a.start_datetime,
          a.end_datetime
        FROM bookings b
        INNER JOIN availability a ON b.availability_id = a.availability_id
        LEFT JOIN actors ra ON ra.id = b.requester_actor_id AND ra.tenant_id = b.tenant_id
        LEFT JOIN events ev ON ev.tenant_id = b.tenant_id
          AND (b.metadata->>'eventId') IS NOT NULL
          AND ev.id = (b.metadata->>'eventId')::uuid
        WHERE b.tenant_id = $1
          AND b.status = 'requested'
          AND (
            (a.owner_type = 'user' AND a.owner_id = $2)
            -- A2E: ownership do prestador via SSOT canonico (service_offering -> provider_actor_id);
            --    o eixo legado de servico foi removido (coluna morta corrigida na A2E).
            OR (a.owner_type = 'service_offering' AND EXISTS (
              SELECT 1 FROM service_offerings so
              WHERE so.id = a.owner_id
              AND so.provider_actor_id = $2
            ))
            -- F-PROFILE-READERS-BROKEN-COLUMNS-FIX: groups usa PK id (nao group_id) e dono vivo
            --    owner_actor_id (owner_user_id nunca existiu no schema vivo).
            OR (a.owner_type = 'group' AND EXISTS (
              SELECT 1 FROM groups g
              WHERE g.id = a.owner_id
              AND g.owner_actor_id = $2
            ))
            -- 🔴 2026-08-05 — LOCAÇÃO ESTAVA FORA, e isso tornava o pilar inteiro invisível.
            -- (sem crase neste comentario DE PROPOSITO: ele mora dentro de um template literal,
            --  onde a crase FECHA a string. Quebrou a compilacao aqui, a terceira vez no mesmo dia.)
            -- Medido: pedido de locacao nasce 201 requested e NUNCA aparecia para o dono decidir.
            -- A caixa de entrada cobria user/service_offering/group e ignorava actor_asset — o
            -- owner_type que a convergência asset-first tornou canônico para todo bem locável.
            -- Nenhum erro em lugar nenhum: o pedido simplesmente não existia para quem devia
            -- responder. Guard contra a reincidência: audit-inbox-covers-every-owner-type.mjs.
            OR (a.owner_type = 'actor_asset' AND EXISTS (
              SELECT 1 FROM actor_assets aa
              WHERE aa.id = a.owner_id
              AND aa.tenant_id = b.tenant_id
              AND aa.owner_actor_id = $2
            ))
          )
        ORDER BY b.requested_at DESC
        LIMIT 20
        `,
        [tenantId, actor.actor_id]
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
        requestedAt: row.requestedAt.toISOString(),
        // 🔴 O QUE O DONO PRECISA PARA DECIDIR (2026-08-05). Antes ele via um intervalo de tempo e
        // um id de actor — e tinha que aceitar ou recusar com isso. O pedido carregava contexto
        // desde hoje de manhã e ele não chegava até aqui.
        notes: row.notes,
        eventId: row.event_id,
        // título nulo com id presente = existe evento e não consegui ler o nome. NÃO colapsar em
        // "sem evento": ausência de título não é ausência de vínculo.
        eventTitle: row.event_title,
        requester: {
          actorId: row.requester_actor_id,
          displayName: row.requester_display_name,
          // desde quando existe e quantos compromissos REAIS cumpriu — os dois fatos que dá para
          // medir hoje. Reputação segue FORA: 5 substratos, 0 linhas. Score inventado na hora do
          // aceite seria mentira institucional, e é a hora em que ela custa mais caro.
          memberSince: row.requester_since ? row.requester_since.toISOString() : null,
          completedCommitments: Number(row.requester_commitments ?? 0),
          trust: null,
        },
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




