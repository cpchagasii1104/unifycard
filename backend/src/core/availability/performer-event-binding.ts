// backend/src/core/availability/performer-event-binding.ts
// 🔴 C3 EDGE C-2 — BIND CONFIÁVEL do performer ao ELENCO no confirm (F-ORCHESTRATED-CONTRACTING).
//
// Quando um booking de service_offering é CONFIRMADO e carrega metadata.eventId, o PERFORMER (o provider da
// oferta, DERIVADO server-side — nunca o requester) é vinculado ao elenco do evento via o WRITER SELADO
// operationalCommitmentsService.createCommitment (event_staff, actor-first, factual/sem-economia). NÃO existe
// segundo writer de vínculo (§4.8) — este módulo apenas COMPÕE o writer selado.
//
// 🔴 LIÇÃO F4 (load-bearing): a Fatia 4 emitiu um EFEITO no outbox mas NENHUM consumidor existia → vínculo
// OCO. Aqui o bind é SÍNCRONO e ACONTECE de fato no chokepoint (Opção A): sem outbox, sem projetor não-inscrito.
// É NÃO-CRÍTICO — o caller envolve em try/catch e uma falha de bind NUNCA desfaz o booking confirmado — mas
// quando roda, a linha de event_staff MATERIALIZA (provado no E2E, que assere a linha real, não "efeito emitido").
//
// 🔴 IDEMPOTÊNCIA (obrigatória — createCommitment NÃO deduplica): antes de vincular, checa uma linha de
// event_staff já existente para (tenant, event_id, responsible_actor_id, role). Um confirm repetido/duplicado
// resulta em EXATAMENTE UMA linha de elenco.
//
// 🔴 MONEY-FREE: o vínculo é PURAMENTE factual (sem economia); createCommitment não toca dinheiro (Δbank=0, porta-01 FORA).

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { operationalCommitmentsService } from '@core/events/operational-commitments.service';

// Papel do vínculo. String livre (o vocabulário governado de papel fica diferido ao C2 event_actors — DECISION
// resolvida da fatia). 'artist' = o performer contratado entra no elenco como atração.
const BIND_ROLE = 'artist';

// Tipos de actor aceitos pelo contrato de OperationalCommitment (event_staff.responsible_actor_type).
const COMMITMENT_ACTOR_TYPES = ['user', 'page', 'group', 'channel'] as const;
type CommitmentActorType = (typeof COMMITMENT_ACTOR_TYPES)[number];

export interface PerformerEventBindingInput {
  tenantId: string;
  eventId: string;
  /** Performer a vincular — SEMPRE o provider DERIVADO server-side (resolveAvailabilityOwner), NUNCA o requester. */
  performerActorId: string;
  /** Booking recém-confirmado (rastreabilidade no time_window_ref; a chave de dedup NÃO depende dele). */
  bookingId: string;
  /** Janela do compromisso (da availability ligada ao booking, nunca do body). Referência informacional. */
  startIso: string;
  endIso: string;
}

export interface PerformerEventBindingResult {
  bound: boolean;
  reason: 'bound' | 'already_bound' | 'event_absent' | 'performer_absent';
  commitmentId?: string;
}

/**
 * Vincula (idempotente) o performer confirmado ao elenco do evento. Retorna o resultado factual; o caller
 * (chokepoint de confirm) trata como NÃO-CRÍTICO. Nunca lança para o caminho de confirm quando usado com try/catch.
 */
export async function bindConfirmedPerformerToEvent(
  input: PerformerEventBindingInput
): Promise<PerformerEventBindingResult> {
  const { tenantId, eventId, performerActorId, bookingId, startIso, endIso } = input;

  // 0) evento existe no tenant (defensivo — createCommitment revalida, mas evitamos ruído/exceção esperada).
  const event = await runQueryWithTenant<{ id: string }>(
    tenantId,
    `SELECT id::text AS id FROM events WHERE id = $1::uuid AND tenant_id = $2::uuid LIMIT 1`,
    [eventId, tenantId]
  );
  if (!event) {
    return { bound: false, reason: 'event_absent' };
  }

  // 1) IDEMPOTÊNCIA — já há linha de elenco para (tenant, event, performer, role)? Então NÃO duplica.
  const existing = await runQueriesWithTenant<{ id: string }>(
    tenantId,
    `SELECT es.id::text AS id
       FROM event_staff es
      WHERE es.tenant_id = $1::uuid
        AND es.event_id = $2::uuid
        AND es.responsible_actor_id = $3::uuid
        AND es.role = $4
      LIMIT 1`,
    [tenantId, eventId, performerActorId, BIND_ROLE]
  );
  if (existing.length > 0) {
    return { bound: false, reason: 'already_bound', commitmentId: existing[0].id };
  }

  // 2) tipo do actor do performer (contrato exige responsible_actor_type). Resolvido do schema vivo (actor_id = id).
  const performer = await runQueryWithTenant<{ actor_type: string }>(
    tenantId,
    `SELECT actor_type FROM actors WHERE tenant_id = $1::uuid AND actor_id = $2::uuid LIMIT 1`,
    [tenantId, performerActorId]
  );
  if (!performer) {
    return { bound: false, reason: 'performer_absent' };
  }
  const actorType = (COMMITMENT_ACTOR_TYPES as readonly string[]).includes(performer.actor_type)
    ? (performer.actor_type as CommitmentActorType)
    : 'user'; // fallback conservador ao tipo humano canônico (o gate de createCommitment revalida).

  // 3) BIND via WRITER SELADO — factual, sem economia. time_window_ref carrega a janela + bookingId (rastreio).
  const commitment = await operationalCommitmentsService.createCommitment(tenantId, {
    eventId,
    responsibleActorId: performerActorId,
    responsibleActorType: actorType,
    role: BIND_ROLE,
    timeWindowRef: { startDatetime: startIso, endDatetime: endIso, bookingId } as any,
  });

  return { bound: true, reason: 'bound', commitmentId: commitment.id };
}
