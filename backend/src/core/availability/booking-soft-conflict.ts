// backend/src/core/availability/booking-soft-conflict.ts
//
// F4 — ARCO FUNDAÇÃO EVENTOS · AVISO SUAVE de conflito de agenda POR PESSOA (cross-membership).
// Doutrina (Clayton): "a agenda é universal (por pessoa), mas sem engessar — NOTIFICAÇÃO, nunca
// bloqueio duro." Quando um booking CONFIRMA para o provider P, detecta se alguma PESSOA ligada a P
// tem OUTRO compromisso confirmado sobreposto no mesmo intervalo em outras bandas ou solo — e emite
// um aviso suave. NUNCA bloqueia; NUNCA desfaz o confirm.
//
// SINK (OP-2 ratificada pela direção 2026-07-23, após STOP da executora): o substrato notify
// (notify_queue/notify_templates) é FANTASMA DE SCHEMA — a tabela não existe na cadeia viva de
// migrations nem no dev (DT-NOTIFY-SUBSTRATE-SCHEMA-GHOST registrada à parte pela direção). O aviso
// vai pelo substrato VIVO: event_outbox + ActorEffect.AVAILABILITY_CONFLICT_DETECTED (mesmo effect
// já emitido no createBooking para conflito de requester; payload distinto via
// metadata.source='booking_confirm_cross_membership'). Consumer REAL: event-outbox-worker (BOOT)
// → EventBus → social-inbox.projector targeta payload.actorId (item de inbox). Dedup natural do
// outbox: event_id determinístico + ON CONFLICT (event_id) DO NOTHING.
//
// GRANULARIDADE v1 (costura futura declarada): bookings ainda NÃO referenciam
// service_offering_configs — o aviso é por MEMBRO DA BANDA (todas as pessoas ativas do grupo),
// não pelo line-up da config contratada. Quando booking→config existir, estreitar `pessoas` para
// o line-up da config (service_offering_config_members) será uma evolução DESTE helper, com gate
// próprio. NÃO construir agora.
//
// §2 (GATE F4): NÃO existe (e não pode nascer) tabela/agenda materializada por pessoa — a agenda
// da pessoa é DERIVADA na hora, por composição das memberships ativas + bookings confirmados.
// Não-crítico: falha aqui NUNCA sobe para o caminho de confirm (try/catch no chokepoint).
// Bank-free: zero leitura/escrita em substrato financeiro.

import { getClientWithTenant } from '@core/database/pool';
import { insertEventOutboxRow, outboxEventIdFromSeed } from '@core/events/event-outbox.repository';
import { ActorEffect } from '@core/social/ports';

export interface CrossMembershipSoftConflictInput {
  tenantId: string;
  /** Provider recém-confirmado (P) — SEMPRE derivado server-side (resolveAvailabilityOwner), nunca do body. */
  providerActorId: string;
  /** Booking recém-confirmado (excluído da busca de conflito). */
  bookingId: string;
  /** Availability do booking confirmado (sourceId do aviso no inbox). */
  availabilityId: string;
  /** Intervalo meio-aberto [start,end) — da availability ligada ao booking, nunca do body. */
  startIso: string;
  endIso: string;
}

interface ConflictRow {
  person_actor_id: string;
  person_user_id: string | null;
  other_provider_actor_id: string;
  other_booking_id: string;
  other_start: Date;
  other_end: Date;
}

/**
 * Detecta compromissos confirmados SOBREPOSTOS de outras dimensões da MESMA PESSOA
 * (outras bandas via memberships ativas; ato solo via o próprio user-actor) e emite
 * o aviso suave no event_outbox. Devolve o nº de avisos candidatos emitidos
 * (idempotentes — re-emissão do mesmo par não duplica: event_id determinístico).
 *
 * NUNCA lança para o caller decidir bloquear: o contrato é aviso, não veto. Ainda
 * assim, qualquer erro interno sobe como exceção e é engolido pelo try/catch
 * NÃO-CRÍTICO do chokepoint de confirm (unified-availability.service).
 */
export async function detectAndEmitCrossMembershipSoftConflict(
  input: CrossMembershipSoftConflictInput
): Promise<number> {
  const { tenantId, providerActorId, bookingId, availabilityId, startIso, endIso } = input;

  // ── 1. DETECÇÃO — 3 CTEs não-recursivas. Predicado de sobreposição REUSA a FORMA do
  //       hard-lock selado (unified-availability.repository.confirmBookingWithProviderLock):
  //       status bloqueante {confirmed,checked_in,checked_out}, intervalo meio-aberto
  //       (a2.start_datetime < $5 AND a2.end_datetime > $4), self excluído (b2.booking_id <> $3).
  //       Diferença DELIBERADA: aqui o rollup é pelas OUTRAS dimensões da pessoa
  //       (pr.provider_actor_id <> $2) — o mesmo provider P já é vetado pelo hard-lock.
  const detectClient = await getClientWithTenant(tenantId);
  let conflicts: ConflictRow[];
  let ownerActorId: string | null;
  try {
    const res = await detectClient.query<ConflictRow>(
      `WITH pessoas AS (
         -- P banda (actor_type='group'): membros ATIVOS do grupo (idx_gam_group)
         SELECT m.member_actor_id AS person_actor_id
           FROM actors ap
           JOIN group_actor_memberships m
             ON m.tenant_id = ap.tenant_id AND m.group_id = ap.group_id AND m.status = 'active'
          WHERE ap.tenant_id = $1 AND ap.id = $2 AND ap.actor_type = 'group' AND ap.group_id IS NOT NULL
         UNION
         -- P solo (actor_type='user'): a própria pessoa
         SELECT au.id AS person_actor_id
           FROM actors au
          WHERE au.tenant_id = $1 AND au.id = $2 AND au.actor_type = 'user'
       ),
       provedores AS (
         -- (a) o PRÓPRIO actor da pessoa como provider (dimensão solo)
         SELECT p.person_actor_id, p.person_actor_id AS provider_actor_id
           FROM pessoas p
         UNION
         -- (b) grupo-actors das OUTRAS memberships ativas da pessoa (idx_gam_member → actors.group_id)
         SELECT m2.member_actor_id AS person_actor_id, ag.id AS provider_actor_id
           FROM pessoas p
           JOIN group_actor_memberships m2
             ON m2.tenant_id = $1 AND m2.member_actor_id = p.person_actor_id AND m2.status = 'active'
           JOIN actors ag
             ON ag.tenant_id = m2.tenant_id AND ag.group_id = m2.group_id AND ag.actor_type = 'group'
       ),
       conflitos AS (
         SELECT DISTINCT pr.person_actor_id,
                pr.provider_actor_id AS other_provider_actor_id,
                b2.booking_id       AS other_booking_id,
                a2.start_datetime   AS other_start,
                a2.end_datetime     AS other_end
           FROM provedores pr
           JOIN service_offerings so2 ON so2.provider_actor_id = pr.provider_actor_id AND so2.tenant_id = $1
           JOIN availability a2 ON a2.owner_id = so2.id AND a2.tenant_id = so2.tenant_id AND a2.owner_type = 'service_offering'
           JOIN bookings b2 ON b2.availability_id = a2.availability_id AND b2.tenant_id = a2.tenant_id
          WHERE pr.provider_actor_id <> $2
            AND b2.status IN ('confirmed','checked_in','checked_out')
            AND b2.booking_id <> $3
            AND a2.start_datetime < $5
            AND a2.end_datetime > $4
       )
       SELECT c.person_actor_id::text        AS person_actor_id,
              pa.user_id::text               AS person_user_id,
              c.other_provider_actor_id::text AS other_provider_actor_id,
              c.other_booking_id::text        AS other_booking_id,
              c.other_start, c.other_end
         FROM conflitos c
         JOIN actors pa ON pa.id = c.person_actor_id AND pa.tenant_id = $1`,
      [tenantId, providerActorId, bookingId, startIso, endIso]
    );
    conflicts = res.rows;
    if (conflicts.length === 0) return 0;
    // Dono do ato recém-confirmado: banda → groups.owner_actor_id (âncora civil);
    // solo → o próprio P (a pessoa é dona do próprio ato).
    const ownerRes = await detectClient.query<{ owner_actor_id: string }>(
      `SELECT COALESCE(g.owner_actor_id, a.id)::text AS owner_actor_id
         FROM actors a
         LEFT JOIN groups g ON g.id = a.group_id AND g.tenant_id = a.tenant_id
        WHERE a.tenant_id = $1 AND a.id = $2`,
      [tenantId, providerActorId]
    );
    ownerActorId = ownerRes.rows[0]?.owner_actor_id ?? null;
  } finally {
    detectClient.release();
  }

  // ── 2. EMISSÃO — 1 effect por (par de bookings × pessoa × destinatário).
  //       Destinatários v1: (a) a PESSOA em conflito (só se for pessoa real — actors.user_id
  //       presente; membro page/group é pulado em silêncio, estrutural); (b) o DONO da banda
  //       cujo booking ACABOU de confirmar (não o dono da outra banda — v1). Se pessoa == dono
  //       (direção solo), o event_id determinístico colapsa num único aviso.
  const startMs = Date.parse(startIso);
  const endMs = Date.parse(endIso);
  type Pending = { eventId: string; recipientActorId: string; row: ConflictRow; dedupeKey: string };
  const pending = new Map<string, Pending>();
  for (const row of conflicts) {
    const pair = [bookingId, row.other_booking_id].sort().join('~');
    const recipients: string[] = [];
    if (row.person_user_id !== null) recipients.push(row.person_actor_id);
    if (ownerActorId !== null) recipients.push(ownerActorId);
    for (const recipientActorId of recipients) {
      // Semente do dedup: par ordenado de bookings + pessoa + destinatário (determinística;
      // re-emissão idêntica cai no ON CONFLICT (event_id) DO NOTHING do outbox).
      const dedupeKey = `x-membership:${tenantId}:${pair}:${row.person_actor_id}:${recipientActorId}`;
      const eventId = outboxEventIdFromSeed(`${ActorEffect.AVAILABILITY_CONFLICT_DETECTED}:${dedupeKey}`);
      if (!pending.has(eventId)) pending.set(eventId, { eventId, recipientActorId, row, dedupeKey });
    }
  }
  if (pending.size === 0) return 0;

  const outboxClient = await getClientWithTenant(tenantId);
  try {
    await outboxClient.query('BEGIN');
    for (const p of pending.values()) {
      const otherStartMs = new Date(p.row.other_start).getTime();
      const otherEndMs = new Date(p.row.other_end).getTime();
      await insertEventOutboxRow(outboxClient, {
        tenantId,
        eventId: p.eventId,
        eventType: ActorEffect.AVAILABILITY_CONFLICT_DETECTED,
        eventVersion: 1,
        payload: {
          actorId: p.recipientActorId, // destinatário do aviso — resolvido server-side, nunca do body
          actorType: 'user',
          sourceId: availabilityId,
          sourceType: 'availability',
        },
        metadata: {
          source: 'booking_confirm_cross_membership', // discrimina do emissor 'booking_created'
          bookingId,
          availabilityId,
          providerActorId,
          otherBookingId: p.row.other_booking_id,
          otherProviderActorId: p.row.other_provider_actor_id,
          memberActorId: p.row.person_actor_id,
          overlapStart: new Date(Math.max(startMs, otherStartMs)).toISOString(),
          overlapEnd: new Date(Math.min(endMs, otherEndMs)).toISOString(),
          dedupeKey: p.dedupeKey,
        },
      });
    }
    await outboxClient.query('COMMIT');
  } catch (err) {
    await outboxClient.query('ROLLBACK');
    throw err;
  } finally {
    outboxClient.release();
  }
  return pending.size;
}
