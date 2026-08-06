// backend/src/modules/demands/demand.repository.ts
// DECISION-0164 — persistência da demanda. SÓ toca service_demands/service_demand_responses
// (+ leitura de concepts/actors p/ projeção). NUNCA bank_*.

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { DemandResponse, DemandResponseStatus, ServiceDemand } from './demand.types';
import { isQuoteExpired } from './quote-validity';

const D_COLS = `d.id, d.tenant_id, d.actor_id, d.concept_id, d.title, d.description, d.vinculo,
  d.quantity, d.quantity_filled, d.date_start, d.date_end, d.time_start, d.time_end, d.weekdays,
  d.radius_km, d.break_minutes, d.acceptance_mode, d.pricing_mode, d.offered_price_cents, d.cancel_notice_hours,
  d.visibility, d.audience_relationship_types, d.status, d.need_id, d.created_at, d.updated_at, c.slug AS concept_slug`;

function toDemand(r: any): ServiceDemand {
  return {
    id: r.id, tenantId: r.tenant_id, actorId: r.actor_id, conceptId: r.concept_id,
    conceptSlug: r.concept_slug ?? undefined,
    title: r.title, description: r.description ?? null, vinculo: r.vinculo,
    quantity: Number(r.quantity), quantityFilled: Number(r.quantity_filled),
    dateStart: r.date_start ? (r.date_start instanceof Date ? r.date_start.toISOString().slice(0, 10) : String(r.date_start).slice(0, 10)) : null,
    dateEnd: r.date_end ? (r.date_end instanceof Date ? r.date_end.toISOString().slice(0, 10) : String(r.date_end).slice(0, 10)) : null,
    timeStart: r.time_start ?? null, timeEnd: r.time_end ?? null,
    weekdays: r.weekdays ?? null,
    radiusKm: r.radius_km !== null && r.radius_km !== undefined ? Number(r.radius_km) : null,
    breakMinutes: r.break_minutes !== null && r.break_minutes !== undefined ? Number(r.break_minutes) : null,
    acceptanceMode: r.acceptance_mode, pricingMode: r.pricing_mode,
    offeredPriceCents: r.offered_price_cents !== null && r.offered_price_cents !== undefined ? Number(r.offered_price_cents) : null,
    cancelNoticeHours: r.cancel_notice_hours !== null && r.cancel_notice_hours !== undefined ? Number(r.cancel_notice_hours) : null,
    visibility: r.visibility, audienceRelationshipTypes: r.audience_relationship_types ?? null, status: r.status,
    // 🔴 DECISION-0196 §H — a chave evento↔demanda. NULL = demanda avulsa (sem evento).
    needId: r.need_id ?? null,
    createdAt: new Date(r.created_at).toISOString(), updatedAt: new Date(r.updated_at).toISOString(),
  };
}

function toResponse(r: any): DemandResponse {
  return {
    id: r.id, tenantId: r.tenant_id, demandId: r.demand_id, providerActorId: r.provider_actor_id,
    providerDisplayName: r.provider_display_name ?? undefined,
    status: r.status, quoteCents: r.quote_cents !== null && r.quote_cents !== undefined ? Number(r.quote_cents) : null,
    message: r.message ?? null,
    // DECISION-0196: validade e o que está sendo ofertado viajam na projeção — sem isso a tela não
    // consegue derivar "vencido" nem mostrar o que foi cotado.
    expiresAt: new Date(r.expires_at).toISOString(),
    // 🔴 DERIVADO na leitura pelo LEITOR ÚNICO — nunca comparado aqui à mão. `expirado` não é
    // gravado em lugar nenhum (não há status `expired` no CHECK vivo, e não deve haver: exigiria
    // worker, e worker que não roda produz orçamento vencido que o sistema jura estar vivo).
    isExpired: isQuoteExpired(r.expires_at),
    offeringId: r.offering_id ?? null,
    assetId: r.asset_id ?? null,
    createdAt: new Date(r.created_at).toISOString(), updatedAt: new Date(r.updated_at).toISOString(),
  };
}

class DemandRepository {
  async findConcept(tenantId: string, ref: { conceptId?: string; conceptSlug?: string }) {
    if (ref.conceptId) {
      return runQueryWithTenant<{ concept_id: string; slug: string }>(
        tenantId, `SELECT concept_id::text, slug FROM concepts WHERE concept_id = $1`, [ref.conceptId]);
    }
    if (ref.conceptSlug) {
      return runQueryWithTenant<{ concept_id: string; slug: string }>(
        tenantId, `SELECT concept_id::text, slug FROM concepts WHERE slug = $1`, [ref.conceptSlug]);
    }
    return undefined;
  }

  async create(tenantId: string, actorId: string, d: {
    conceptId: string; title: string; description: string | null; vinculo: string; quantity: number;
    dateStart: string | null; dateEnd: string | null; timeStart: string | null; timeEnd: string | null;
    weekdays: number[] | null; radiusKm: number | null; breakMinutes: number | null; acceptanceMode: string; pricingMode: string;
    offeredPriceCents: number | null; cancelNoticeHours: number | null; visibility: string;
    audienceRelationshipTypes: string[] | null; needId?: string | null;
  }): Promise<ServiceDemand> {
    const row = await runQueryWithTenant<any>(
      tenantId,
      `WITH ins AS (
         INSERT INTO service_demands (
           tenant_id, actor_id, concept_id, title, description, vinculo, quantity,
           date_start, date_end, time_start, time_end, weekdays, radius_km, break_minutes,
           acceptance_mode, pricing_mode, offered_price_cents, cancel_notice_hours, visibility,
           audience_relationship_types, need_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::text[],$21::uuid)
         RETURNING *
       )
       SELECT ${D_COLS.replace(/d\./g, 'ins.').replace('c.slug AS concept_slug', 'c.slug AS concept_slug')}
         FROM ins JOIN concepts c ON c.concept_id = ins.concept_id`,
      [tenantId, actorId, d.conceptId, d.title, d.description, d.vinculo, d.quantity,
       d.dateStart, d.dateEnd, d.timeStart, d.timeEnd, d.weekdays, d.radiusKm, d.breakMinutes,
       d.acceptanceMode, d.pricingMode, d.offeredPriceCents, d.cancelNoticeHours, d.visibility,
       d.audienceRelationshipTypes, d.needId ?? null]
    );
    return toDemand(row);
  }

  /**
   * 🔴 DECISION-0196 §H + DECISION-0146 §A.6 — a COERÊNCIA DE TENANT que o banco NÃO consegue dar.
   * `event_operational_needs` não tem `tenant_id` (o tenant mora um salto adiante, em `events`), e
   * não tem RLS — enquanto `service_demands` tem os dois. Uma FK simples deixaria uma demanda do
   * tenant A apontar para need de evento do tenant B: DUAS respostas para "de quem é isto".
   * Devolve o `event_id` quando a need existe E pertence ao tenant; `null` em qualquer outro caso
   * (inexistente, de outro tenant, órfã) — o caller recusa fail-closed. NUNCA devolve `false`/`0`
   * para "não consegui ler": ausência aqui é ausência de fato, verificada por JOIN.
   */
  async findNeedEventIdInTenant(tenantId: string, needId: string): Promise<string | null> {
    const row = await runQueryWithTenant<{ event_id: string }>(
      tenantId,
      `SELECT e.id::text AS event_id
         FROM event_operational_needs n
         JOIN events e ON e.id = n.event_id
        WHERE n.id = $2::uuid AND e.tenant_id = $1::uuid
        LIMIT 1`,
      [tenantId, needId]);
    return row?.event_id ?? null;
  }

  /** Vincula o post-espelho do feed (projeção; a demanda é a verdade). */
  async setPostId(tenantId: string, demandId: string, postId: string): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `UPDATE service_demands SET post_id = $3, updated_at = now() WHERE tenant_id = $1 AND id = $2`,
      [tenantId, demandId, postId]);
  }

  async findById(tenantId: string, id: string): Promise<ServiceDemand | null> {
    const row = await runQueryWithTenant<any>(
      tenantId,
      `SELECT ${D_COLS} FROM service_demands d JOIN concepts c ON c.concept_id = d.concept_id
        WHERE d.tenant_id = $1 AND d.id = $2`, [tenantId, id]);
    return row ? toDemand(row) : null;
  }

  async listMine(tenantId: string, actorId: string): Promise<ServiceDemand[]> {
    const rows = await runQueriesWithTenant<any>(
      tenantId,
      `SELECT ${D_COLS} FROM service_demands d JOIN concepts c ON c.concept_id = d.concept_id
        WHERE d.tenant_id = $1 AND d.actor_id = $2 ORDER BY d.created_at DESC LIMIT 100`,
      [tenantId, actorId]);
    return rows.map(toDemand);
  }

  /** PULL "ver oportunidades": demandas ABERTAS visíveis pro provider — públicas OU
   *  'connections' com aresta ACEITA (refinamento pela ÓTICA DO EMISSOR, padrão 0162).
   *  ?matching filtra pelos conceitos do PERFIL C1 do provider. */
  async listOpportunities(tenantId: string, providerActorId: string, onlyMatching: boolean): Promise<ServiceDemand[]> {
    const rows = await runQueriesWithTenant<any>(
      tenantId,
      `SELECT ${D_COLS} FROM service_demands d
        JOIN concepts c ON c.concept_id = d.concept_id
        WHERE d.tenant_id = $1 AND d.status = 'open'
          AND d.actor_id <> $2
          AND (
            d.visibility = 'public'
            OR (
              d.visibility = 'connections'
              AND EXISTS (
                SELECT 1 FROM actor_relationships ar
                WHERE ar.tenant_id = d.tenant_id AND ar.status = 'accepted'
                  AND ((ar.from_actor_id = d.actor_id AND ar.to_actor_id = $2)
                    OR (ar.from_actor_id = $2 AND ar.to_actor_id = d.actor_id))
                  AND (
                    d.audience_relationship_types IS NULL
                    OR (CASE WHEN ar.from_actor_id = d.actor_id
                             THEN ar.requester_label ELSE ar.target_label END)
                       = ANY(d.audience_relationship_types)
                  )
              )
            )
          )
          AND ($3::boolean = false OR d.concept_id IN (
            SELECT apc.concept_id FROM actor_professional_concepts apc
             WHERE apc.tenant_id = $1 AND apc.actor_id = $2
          ))
        ORDER BY d.created_at DESC LIMIT 100`,
      [tenantId, providerActorId, onlyMatching]);
    return rows.map(toDemand);
  }

  /** ANTI-DOUBLE-COMMIT (item 2 do fechamento): o provider já tem compromisso
   *  (accepted/chosen) cuja JANELA colide com esta demanda? Cobre diaria/periodo com
   *  horários; recorrente/efetivo = fase 2 (integração Agenda universal, nomeada). */
  async hasScheduleConflict(tenantId: string, providerActorId: string, d: ServiceDemand): Promise<boolean> {
    if ((d.vinculo !== 'diaria' && d.vinculo !== 'periodo') || !d.dateStart) return false;
    const row = await runQueryWithTenant<{ conflict: boolean }>(
      tenantId,
      `SELECT EXISTS (
         SELECT 1 FROM service_demand_responses r
         JOIN service_demands x ON x.id = r.demand_id
        WHERE r.tenant_id = $1 AND r.provider_actor_id = $2
          AND r.status IN ('accepted','chosen')
          AND x.vinculo IN ('diaria','periodo') AND x.date_start IS NOT NULL
          AND daterange(x.date_start, COALESCE(x.date_end, x.date_start), '[]')
              && daterange($3::date, COALESCE($4::date, $3::date), '[]')
          AND (
            x.time_start IS NULL OR $5::time IS NULL
            OR (x.time_start < COALESCE($6::time, '23:59'::time)
                AND COALESCE(x.time_end, '23:59'::time) > $5::time)
          )
       ) AS conflict`,
      [tenantId, providerActorId, d.dateStart, d.dateEnd, d.timeStart, d.timeEnd]);
    return !!row?.conflict;
  }

  /** AUDIÊNCIA (fix Yala #6): o viewer PODE ver/agir nesta demanda? Mesmo predicado da
   *  lista (public OR conexão aceita + refinamento pela ótica do EMISSOR) + o próprio emissor. */
  async isActorInAudience(tenantId: string, viewerActorId: string, demandId: string): Promise<boolean> {
    const row = await runQueryWithTenant<{ ok: boolean }>(
      tenantId,
      `SELECT EXISTS (
         SELECT 1 FROM service_demands d
          WHERE d.tenant_id = $1 AND d.id = $2
            AND (
              d.actor_id = $3
              OR d.visibility = 'public'
              OR (
                d.visibility = 'connections'
                AND EXISTS (
                  SELECT 1 FROM actor_relationships ar
                  WHERE ar.tenant_id = d.tenant_id AND ar.status = 'accepted'
                    AND ((ar.from_actor_id = d.actor_id AND ar.to_actor_id = $3)
                      OR (ar.from_actor_id = $3 AND ar.to_actor_id = d.actor_id))
                    AND (
                      d.audience_relationship_types IS NULL
                      OR (CASE WHEN ar.from_actor_id = d.actor_id
                               THEN ar.requester_label ELSE ar.target_label END)
                         = ANY(d.audience_relationship_types)
                    )
                )
              )
            )
       ) AS ok`,
      [tenantId, demandId, viewerActorId]);
    return !!row?.ok;
  }

  /** TRANSIÇÃO CONDICIONAL (fix Yala #4): só atualiza se status atual ∈ from — o row-lock
   *  do UPDATE serializa; concorrente perde a condição e recebe null (sem double-release). */
  async updateResponseStatusIf(tenantId: string, responseId: string, from: DemandResponseStatus[], to: DemandResponseStatus): Promise<DemandResponse | null> {
    const row = await runQueryWithTenant<any>(
      tenantId,
      `UPDATE service_demand_responses SET status = $3, updated_at = now()
        WHERE tenant_id = $1 AND id = $2 AND status = ANY($4)
        RETURNING *`,
      [tenantId, responseId, to, from]);
    return row ? toResponse(row) : null;
  }

  /** DECISION-0196: `expiresAt` é OBRIGATÓRIO (a coluna é NOT NULL sem default — a omissão falha alto,
   *  de propósito). `offeringId`/`assetId` são exclusivos entre si (CHECK no banco). */
  async createResponse(tenantId: string, demandId: string, providerActorId: string,
    status: DemandResponseStatus, quoteCents: number | null, message: string | null,
    expiresAt: Date, offeringId: string | null, assetId: string | null): Promise<DemandResponse> {
    const row = await runQueryWithTenant<any>(
      tenantId,
      `INSERT INTO service_demand_responses
         (tenant_id, demand_id, provider_actor_id, status, quote_cents, message, expires_at, offering_id, asset_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [tenantId, demandId, providerActorId, status, quoteCents, message, expiresAt, offeringId, assetId]);
    return toResponse(row);
  }

  async findResponse(tenantId: string, responseId: string): Promise<DemandResponse | null> {
    const row = await runQueryWithTenant<any>(
      tenantId, `SELECT * FROM service_demand_responses WHERE tenant_id = $1 AND id = $2`,
      [tenantId, responseId]);
    return row ? toResponse(row) : null;
  }

  async listResponses(tenantId: string, demandId: string): Promise<DemandResponse[]> {
    const rows = await runQueriesWithTenant<any>(
      tenantId,
      `SELECT r.*, a.display_name AS provider_display_name
         FROM service_demand_responses r JOIN actors a ON a.id = r.provider_actor_id
        WHERE r.tenant_id = $1 AND r.demand_id = $2 ORDER BY r.created_at ASC`,
      [tenantId, demandId]);
    return rows.map(toResponse);
  }

  /** Incremento ATÔMICO de vaga preenchida — fecha (filled) ao atingir quantity.
   *  Retorna a demanda pós-update ou null se não havia vaga (fail-closed). */
  async fillSlot(tenantId: string, demandId: string): Promise<ServiceDemand | null> {
    const row = await runQueryWithTenant<any>(
      tenantId,
      `WITH upd AS (
         UPDATE service_demands SET
           quantity_filled = quantity_filled + 1,
           status = CASE WHEN quantity_filled + 1 >= quantity THEN 'filled' ELSE status END,
           updated_at = now()
         WHERE tenant_id = $1 AND id = $2 AND status = 'open' AND quantity_filled < quantity
         RETURNING *
       ) SELECT ${D_COLS.replace(/d\./g, 'upd.')} FROM upd JOIN concepts c ON c.concept_id = upd.concept_id`,
      [tenantId, demandId]);
    return row ? toDemand(row) : null;
  }

  /** Libera vaga (cancelamento do provider) — REABRE se estava filled. */
  async releaseSlot(tenantId: string, demandId: string): Promise<ServiceDemand | null> {
    const row = await runQueryWithTenant<any>(
      tenantId,
      `WITH upd AS (
         UPDATE service_demands SET
           quantity_filled = GREATEST(quantity_filled - 1, 0),
           status = CASE WHEN status = 'filled' THEN 'open' ELSE status END,
           updated_at = now()
         WHERE tenant_id = $1 AND id = $2 AND status IN ('open','filled')
         RETURNING *
       ) SELECT ${D_COLS.replace(/d\./g, 'upd.')} FROM upd JOIN concepts c ON c.concept_id = upd.concept_id`,
      [tenantId, demandId]);
    return row ? toDemand(row) : null;
  }
}

export const demandRepository = new DemandRepository();
