// backend/src/core/events/event-operational-needs.service.ts
// F-EVENT-ORCHESTRATION-PHASE-B-WRITE — writer da INSTÂNCIA de necessidade operacional do evento
// (event_operational_needs). Declaração FACTUAL do organizador: NÃO dispara demanda/RFQ/booking/agenda/Bank.
// v1: só SELEÇÃO das sugestões governadas do formato (need ∈ event_orchestration_template_items do
// event_format_concept_id) — NÃO catálogo livre. A FK composta já garante offer_kind='service'; aqui
// validamos também o PERTENCIMENTO ao template. Lifecycle governado da tabela (open/filled/cancelled).

import { runQueriesWithTenant } from '@core/database/pool';

export interface EventOperationalNeed {
  needConceptId: string;
  label: string;
  fulfillmentKind: string;
  status: string;
}

export const eventOperationalNeedsService = {
  /** Necessidades ATIVAS declaradas do evento (para o picker mostrar o que já foi selecionado). */
  async list(tenantId: string, eventId: string): Promise<EventOperationalNeed[]> {
    const rows = await runQueriesWithTenant<{ need_concept_id: string; label: string; fulfillment_kind: string; status: string }>(
      tenantId,
      `SELECT n.need_concept_id, COALESCE(cs.name, c.slug) AS label, n.fulfillment_kind, n.status
         FROM event_operational_needs n
         JOIN concepts c ON c.concept_id = n.need_concept_id
         LEFT JOIN canonical_services cs ON cs.concept_id = n.need_concept_id AND cs.tenant_id IS NULL AND cs.status = 'active'
        WHERE n.event_id = $1 AND n.status <> 'cancelled'
        ORDER BY COALESCE(cs.name, c.slug) ASC`,
      [eventId]
    );
    return rows.map((r) => ({ needConceptId: r.need_concept_id, label: r.label, fulfillmentKind: r.fulfillment_kind, status: r.status }));
  },

  /**
   * Declara uma necessidade. Só grava se needConceptId ∈ template do formato do evento (SELEÇÃO das
   * sugestões, não catálogo livre). Fora do template → retorna null (rota responde 422, não grava).
   * Idempotente: re-declarar reativa (status='open').
   *
   * 🔴 fulfillment_kind é HERDADO do template, não fixo (F-EVENT-ORCHESTRATION-RENTABLE, 2026-08-03).
   * Antes era o literal 'service' — correto enquanto TODO o catálogo era serviço, e QUEBRADO no
   * instante em que o template ganhou necessidade que se resolve LOCANDO (mesma data): selecionar
   * "Mesa de som" tentava gravar ('mesa-de-som','service'), par que NÃO existe em concept_offer_kinds,
   * e a FK composta fk_event_op_needs_need_is_offerable RECUSAVA — erro na cara do organizador, não
   * gravação errada em silêncio. Provado em efêmera contra o código do HEAD.
   * Quem diz COMO a necessidade se resolve é o TEMPLATE; aqui só se copia. A FK segue sendo o
   * enforcement: se o template disser um kind que o concept não oferta, ela continua recusando.
   */
  async add(tenantId: string, eventId: string, needConceptId: string): Promise<EventOperationalNeed | null> {
    const rows = await runQueriesWithTenant<{ need_concept_id: string; fulfillment_kind: string; status: string }>(
      tenantId,
      `INSERT INTO event_operational_needs (event_id, need_concept_id, fulfillment_kind, status)
       SELECT $1::uuid, $2::uuid, t.fulfillment_kind, 'open'
         FROM events e
         JOIN event_orchestration_template_items t
           ON t.format_concept_id = e.event_format_concept_id AND t.need_concept_id = $2::uuid
        WHERE e.id = $1::uuid
       ON CONFLICT (event_id, need_concept_id)
         DO UPDATE SET status = 'open', fulfillment_kind = EXCLUDED.fulfillment_kind, updated_at = now()
       RETURNING need_concept_id, fulfillment_kind, status`,
      [eventId, needConceptId]
    );
    const r = rows[0];
    return r ? { needConceptId: r.need_concept_id, label: '', fulfillmentKind: r.fulfillment_kind, status: r.status } : null;
  },

  /** Remove a seleção via lifecycle governado (status='cancelled'; preserva histórico; re-POST reativa). */
  async remove(tenantId: string, eventId: string, needConceptId: string): Promise<void> {
    await runQueriesWithTenant(
      tenantId,
      `UPDATE event_operational_needs SET status = 'cancelled', updated_at = now()
        WHERE event_id = $1::uuid AND need_concept_id = $2::uuid`,
      [eventId, needConceptId]
    );
  },
};
