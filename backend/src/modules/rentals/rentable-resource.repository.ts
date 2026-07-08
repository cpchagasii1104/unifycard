// backend/src/modules/rentals/rentable-resource.repository.ts
// Leitor/escritor de `rentable_resources` — a única tabela desta fatia (substrato já vivo,
// migration 20260624120000, RLS+FORCE). Sem coluna financeira (se aparecer aqui, viola DECISION-0151).

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  RentableResource,
  RentableResourceRow,
  CreateRentableResourceInput,
  ListRentableResourcesFilters,
} from './rentable-resource.types';

function toDomain(row: RentableResourceRow): RentableResource {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    ownerActorId: row.owner_actor_id,
    conceptId: row.concept_id,
    resourceType: row.resource_type,
    label: row.label,
    description: row.description,
    categoryId: row.category_id,
    pricingUnit: row.pricing_unit,
    priceCents: row.price_cents !== null && row.price_cents !== undefined ? Number(row.price_cents) : null,
    resourceYear: row.resource_year ?? null,
    quantity: row.quantity != null ? Number(row.quantity) : 1,
    bookingApprovalMode: row.booking_approval_mode ?? 'manual',
    startHandoffMethod: row.start_handoff_method ?? 'renter_pickup',
    endHandoffMethod: row.end_handoff_method ?? 'renter_return',
    deliveryRadiusKm: row.delivery_radius_km != null ? Number(row.delivery_radius_km) : null,
    deliveryFeeCents: row.delivery_fee_cents != null ? Number(row.delivery_fee_cents) : null,
    collectionFeeCents: row.collection_fee_cents != null ? Number(row.collection_fee_cents) : null,
    handoffTimeStart: row.handoff_time_start ?? null,
    handoffTimeEnd: row.handoff_time_end ?? null,
    mileagePolicy: row.mileage_policy ?? null,
    includedKmPerDay: row.included_km_per_day != null ? Number(row.included_km_per_day) : null,
    includedKmTotal: row.included_km_total != null ? Number(row.included_km_total) : null,
    extraKmFeeCents: row.extra_km_fee_cents != null ? Number(row.extra_km_fee_cents) : null,
    rentalModality: row.rental_modality ?? null,
    cleaningFeePolicy: row.cleaning_fee_policy ?? null,
    cleaningFeeCents: row.cleaning_fee_cents != null ? Number(row.cleaning_fee_cents) : null,
    metadata: row.metadata ?? {},
    visibility: row.visibility,
    audienceRelationshipTypes: row.audience_relationship_types ?? null,
    status: row.status,
    isActive: row.is_active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

class RentableResourceRepository {
  async create(
    tenantId: string,
    ownerActorId: string,
    input: CreateRentableResourceInput
  ): Promise<RentableResource> {
    const row = await runQueryWithTenant<RentableResourceRow>(
      tenantId,
      `INSERT INTO rentable_resources
         (tenant_id, owner_actor_id, concept_id, resource_type, label, description, category_id, pricing_unit, price_cents, resource_year, metadata, visibility, audience_relationship_types, quantity, booking_approval_mode, start_handoff_method, end_handoff_method, delivery_radius_km, delivery_fee_cents, collection_fee_cents, mileage_policy, included_km_per_day, included_km_total, extra_km_fee_cents, rental_modality, cleaning_fee_policy, cleaning_fee_cents)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7::uuid, $8, $9, $10, $11::jsonb, $12, $13::text[], $14::int, $15, $16, $17, $18::int, $19::bigint, $20::bigint, $21, $22::int, $23::int, $24::bigint, $25, $26, $27::bigint)
       RETURNING id, tenant_id, owner_actor_id, concept_id, resource_type, label, description, pricing_unit, price_cents,
                 category_id, status, is_active, resource_year, metadata, visibility, audience_relationship_types, quantity, booking_approval_mode, start_handoff_method, end_handoff_method, delivery_radius_km, delivery_fee_cents, collection_fee_cents, handoff_time_start, handoff_time_end, mileage_policy, included_km_per_day, included_km_total, extra_km_fee_cents, rental_modality, cleaning_fee_policy, cleaning_fee_cents, created_at, updated_at`,
      [
        tenantId,
        ownerActorId,
        input.conceptId,
        input.resourceType,
        input.label,
        input.description ?? null,
        input.categoryId ?? null,
        input.pricingUnit ?? null,
        input.priceCents ?? null,
        input.resourceYear ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.visibility ?? 'public',
        input.audienceRelationshipTypes ?? null,
        input.quantity ?? 1,
        input.bookingApprovalMode ?? 'manual',
        input.startHandoffMethod ?? 'renter_pickup',
        input.endHandoffMethod ?? 'renter_return',
        input.deliveryRadiusKm ?? null,
        input.deliveryFeeCents ?? null,
        input.collectionFeeCents ?? null,
        input.mileagePolicy ?? null,
        input.includedKmPerDay ?? null,
        input.includedKmTotal ?? null,
        input.extraKmFeeCents ?? null,
        input.rentalModality ?? null,
        input.cleaningFeePolicy ?? null,
        input.cleaningFeeCents ?? null,
      ]
    );
    if (!row) throw new Error('Falha ao criar rentable_resource');
    return toDomain(row);
  }

  async findById(tenantId: string, id: string): Promise<RentableResource | null> {
    const row = await runQueryWithTenant<RentableResourceRow>(
      tenantId,
      `SELECT id, tenant_id, owner_actor_id, concept_id, resource_type, label, description, pricing_unit, price_cents,
              category_id, status, is_active, resource_year, metadata, visibility, audience_relationship_types, quantity, booking_approval_mode, start_handoff_method, end_handoff_method, delivery_radius_km, delivery_fee_cents, collection_fee_cents, handoff_time_start, handoff_time_end, mileage_policy, included_km_per_day, included_km_total, extra_km_fee_cents, rental_modality, cleaning_fee_policy, cleaning_fee_cents, created_at, updated_at
         FROM rentable_resources
        WHERE id = $1::uuid AND tenant_id = $2::uuid
        LIMIT 1`,
      [id, tenantId]
    );
    return row ? toDomain(row) : null;
  }

  async list(tenantId: string, filters: ListRentableResourcesFilters = {}): Promise<RentableResource[]> {
    const limit = Math.min(Math.max(filters.limit ?? 20, 1), 50);
    const offset = Math.max(filters.offset ?? 0, 0);
    const params: unknown[] = [tenantId];
    let where = 'tenant_id = $1::uuid';

    if (filters.ownerActorId) {
      params.push(filters.ownerActorId);
      where += ` AND owner_actor_id = $${params.length}::uuid`;
    }
    if (filters.status) {
      params.push(filters.status);
      where += ` AND status = $${params.length}`;
    }

    params.push(limit, offset);
    const rows = await runQueriesWithTenant<RentableResourceRow>(
      tenantId,
      `SELECT id, tenant_id, owner_actor_id, concept_id, resource_type, label, description, pricing_unit, price_cents,
              category_id, status, is_active, resource_year, metadata, visibility, audience_relationship_types, quantity, booking_approval_mode, start_handoff_method, end_handoff_method, delivery_radius_km, delivery_fee_cents, collection_fee_cents, handoff_time_start, handoff_time_end, mileage_policy, included_km_per_day, included_km_total, extra_km_fee_cents, rental_modality, cleaning_fee_policy, cleaning_fee_cents, created_at, updated_at
         FROM rentable_resources
        WHERE ${where}
        ORDER BY created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return rows.map(toDomain);
  }

  /** DESCOBERTA (modo consumir): recursos ATIVOS visíveis ao viewer pela plateia do DONO — espelho
   *  de service_demands.listOpportunities (0162). public OR próprio-dono OR connections com aresta
   *  aceita + refinamento pela ÓTICA DO EMISSOR. A verdade da visibilidade é do BANCO, não do front. */
  async listDiscoverable(tenantId: string, viewerActorId: string, limit = 50): Promise<RentableResource[]> {
    const rows = await runQueriesWithTenant<RentableResourceRow>(
      tenantId,
      `SELECT r.id, r.tenant_id, r.owner_actor_id, r.concept_id, r.resource_type, r.label, r.description,
              r.pricing_unit, r.price_cents, r.category_id, r.status, r.is_active, r.resource_year,
              r.metadata, r.visibility, r.audience_relationship_types, r.quantity, r.created_at, r.updated_at
         FROM rentable_resources r
        WHERE r.tenant_id = $1::uuid AND r.status = 'active' AND r.owner_actor_id <> $2::uuid
          AND (
            r.visibility = 'public'
            OR (
              r.visibility = 'connections'
              AND EXISTS (
                SELECT 1 FROM actor_relationships ar
                WHERE ar.tenant_id = r.tenant_id AND ar.status = 'accepted'
                  AND ((ar.from_actor_id = r.owner_actor_id AND ar.to_actor_id = $2::uuid)
                    OR (ar.from_actor_id = $2::uuid AND ar.to_actor_id = r.owner_actor_id))
                  AND (
                    r.audience_relationship_types IS NULL
                    OR (CASE WHEN ar.from_actor_id = r.owner_actor_id
                             THEN ar.requester_label ELSE ar.target_label END)
                       = ANY(r.audience_relationship_types)
                  )
              )
            )
          )
        ORDER BY r.created_at DESC LIMIT $3`,
      [tenantId, viewerActorId, Math.min(Math.max(limit, 1), 50)]
    );
    return rows.map(toDomain);
  }

  /**
   * Fase 5 — DESCOBERTA com filtros de localização (backend é a autoridade). Mesma plateia da
   * listDiscoverable + JOIN da cidade/coord do recurso (pickup ativo) + filtros:
   *  - cityId: só recursos daquela cidade.
   *  - lat/lng/radiusKm: só dentro do raio (haversine_distance_km, fn SQL existente); ordena por perto.
   *  - resourceType: filtra o tipo.
   * Retorna recurso + cidade/uf + distanceKm (nunca rua/número — privacidade). Frontend só projeta.
   */
  async discoverRentals(
    tenantId: string, viewerActorId: string,
    f: { cityId?: string | null; lat?: number | null; lng?: number | null; radiusKm?: number | null; resourceType?: string | null },
    limit = 50
  ): Promise<Array<RentableResource & { cityName: string | null; uf: string | null; distanceKm: number | null }>> {
    const params: unknown[] = [tenantId, viewerActorId];
    const hasRadius = f.lat != null && f.lng != null && f.radiusKm != null && f.radiusKm > 0;
    let latIdx = 0, lngIdx = 0, radIdx = 0;
    if (hasRadius) { latIdx = params.push(f.lat); lngIdx = params.push(f.lng); radIdx = params.push(f.radiusKm); }
    const distExpr = hasRadius
      ? `haversine_distance_km($${latIdx}::numeric, $${lngIdx}::numeric, ad.lat, ad.lng)`
      : 'NULL::numeric';
    let extra = '';
    if (f.cityId) extra += ` AND ad.city_id = $${params.push(f.cityId)}::uuid`;
    if (f.resourceType) extra += ` AND r.resource_type = $${params.push(f.resourceType)}`;
    const radiusFilter = hasRadius ? ` AND ad.lat IS NOT NULL AND ad.lng IS NOT NULL AND ${distExpr} <= $${radIdx}` : '';
    params.push(Math.min(Math.max(limit, 1), 50));
    const rows = await runQueriesWithTenant<RentableResourceRow & { city_name: string | null; uf: string | null; distance_km: string | null }>(
      tenantId,
      `SELECT r.id, r.tenant_id, r.owner_actor_id, r.concept_id, r.resource_type, r.label, r.description,
              r.pricing_unit, r.price_cents, r.category_id, r.status, r.is_active, r.resource_year,
              r.metadata, r.visibility, r.audience_relationship_types, r.quantity,
              r.start_handoff_method, r.end_handoff_method, r.delivery_radius_km, r.delivery_fee_cents, r.collection_fee_cents,
              r.created_at, r.updated_at,
              c.name AS city_name, s.abbreviation AS uf, ${distExpr} AS distance_km
         FROM rentable_resources r
         LEFT JOIN address_assignments aa ON aa.owner_type = 'rentable_resource' AND aa.owner_id = r.id
              AND aa.role = 'PICKUP' AND aa.is_primary = true AND aa.valid_until_at IS NULL
         LEFT JOIN addresses ad ON ad.address_id = aa.address_id
         LEFT JOIN cities c ON c.city_id = ad.city_id
         LEFT JOIN states s ON s.state_id = c.state_id
        WHERE r.tenant_id = $1::uuid AND r.status = 'active' AND r.owner_actor_id <> $2::uuid
          AND (
            r.visibility = 'public'
            OR (r.visibility = 'connections' AND EXISTS (
                SELECT 1 FROM actor_relationships ar
                 WHERE ar.tenant_id = r.tenant_id AND ar.status = 'accepted'
                   AND ((ar.from_actor_id = r.owner_actor_id AND ar.to_actor_id = $2::uuid)
                     OR (ar.from_actor_id = $2::uuid AND ar.to_actor_id = r.owner_actor_id))
                   AND (r.audience_relationship_types IS NULL
                     OR (CASE WHEN ar.from_actor_id = r.owner_actor_id THEN ar.requester_label ELSE ar.target_label END)
                        = ANY(r.audience_relationship_types))
            ))
          )
          ${extra}${radiusFilter}
        ORDER BY ${hasRadius ? 'distance_km ASC NULLS LAST, ' : ''}r.created_at DESC
        LIMIT $${params.length}`,
      params);
    return rows.map((row) => ({
      ...toDomain(row),
      cityName: row.city_name,
      uf: row.uf,
      distanceKm: row.distance_km != null ? Math.round(Number(row.distance_km) * 10) / 10 : null,
    }));
  }

  async updateStatus(
    tenantId: string,
    id: string,
    status: 'active' | 'paused' | 'retired'
  ): Promise<RentableResource | null> {
    const row = await runQueryWithTenant<RentableResourceRow>(
      tenantId,
      `UPDATE rentable_resources
          SET status = $3, is_active = ($3 = 'active'), updated_at = now()
        WHERE id = $1::uuid AND tenant_id = $2::uuid
        RETURNING id, tenant_id, owner_actor_id, concept_id, resource_type, label, description, pricing_unit, price_cents,
                  category_id, status, is_active, resource_year, metadata, visibility, audience_relationship_types, quantity, booking_approval_mode, start_handoff_method, end_handoff_method, delivery_radius_km, delivery_fee_cents, collection_fee_cents, handoff_time_start, handoff_time_end, mileage_policy, included_km_per_day, included_km_total, extra_km_fee_cents, rental_modality, cleaning_fee_policy, cleaning_fee_cents, created_at, updated_at`,
      [id, tenantId, status]
    );
    return row ? toDomain(row) : null;
  }

  /** O concept tem o offer_kind pedido (ex.: 'rentable')? Governança concept_offer_kinds. */
  async conceptHasOfferKind(tenantId: string, conceptId: string, offerKind: string): Promise<boolean> {
    const row = await runQueryWithTenant<{ ok: boolean }>(
      tenantId,
      `SELECT EXISTS (SELECT 1 FROM concept_offer_kinds WHERE concept_id = $1::uuid AND offer_kind = $2) AS ok`,
      [conceptId, offerKind]);
    return !!row?.ok;
  }

  async conceptExists(tenantId: string, conceptId: string): Promise<boolean> {
    const row = await runQueryWithTenant<{ concept_id: string }>(
      tenantId,
      `SELECT concept_id FROM concepts WHERE concept_id = $1::uuid LIMIT 1`,
      [conceptId]
    );
    return !!row;
  }

  /** Atualiza campos de OFERTA do recurso (não a identidade). Só sobrescreve o que veio (COALESCE). */
  async updateOffer(tenantId: string, resourceId: string, input: {
    description?: string | null; visibility?: string; audienceRelationshipTypes?: string[] | null; quantity?: number;
    bookingApprovalMode?: string;
    startHandoffMethod?: string; endHandoffMethod?: string;
    deliveryRadiusKm?: number | null; deliveryFeeCents?: number | null; collectionFeeCents?: number | null;
    handoffTouched?: boolean; // quando true, grava as 5 colunas de handoff (permite zerar taxas/raio).
    handoffTimeStart?: string | null; handoffTimeEnd?: string | null; handoffTimeTouched?: boolean;
    mileageTouched?: boolean; // quando true, grava as 4 colunas de mileage (permite zerar/trocar policy).
    mileagePolicy?: string | null; includedKmPerDay?: number | null; includedKmTotal?: number | null; extraKmFeeCents?: number | null;
    modalityTouched?: boolean; rentalModality?: string | null;
    cleaningTouched?: boolean; cleaningFeePolicy?: string | null; cleaningFeeCents?: number | null;
  }): Promise<void> {
    await runQueriesWithTenant(tenantId,
      `UPDATE rentable_resources SET
         description = CASE WHEN $2::boolean THEN $3 ELSE description END,
         visibility = COALESCE($4, visibility),
         audience_relationship_types = CASE WHEN $5::boolean THEN $6::text[] ELSE audience_relationship_types END,
         quantity = COALESCE($7::int, quantity),
         booking_approval_mode = COALESCE($8, booking_approval_mode),
         start_handoff_method = COALESCE($9, start_handoff_method),
         end_handoff_method = COALESCE($10, end_handoff_method),
         delivery_radius_km = CASE WHEN $11::boolean THEN $12::int ELSE delivery_radius_km END,
         delivery_fee_cents = CASE WHEN $11::boolean THEN $13::bigint ELSE delivery_fee_cents END,
         collection_fee_cents = CASE WHEN $11::boolean THEN $14::bigint ELSE collection_fee_cents END,
         handoff_time_start = CASE WHEN $15::boolean THEN $16::time ELSE handoff_time_start END,
         handoff_time_end = CASE WHEN $15::boolean THEN $17::time ELSE handoff_time_end END,
         mileage_policy = CASE WHEN $18::boolean THEN $19 ELSE mileage_policy END,
         included_km_per_day = CASE WHEN $18::boolean THEN $20::int ELSE included_km_per_day END,
         included_km_total = CASE WHEN $18::boolean THEN $21::int ELSE included_km_total END,
         extra_km_fee_cents = CASE WHEN $18::boolean THEN $22::bigint ELSE extra_km_fee_cents END,
         rental_modality = CASE WHEN $23::boolean THEN $24 ELSE rental_modality END,
         cleaning_fee_policy = CASE WHEN $25::boolean THEN $26 ELSE cleaning_fee_policy END,
         cleaning_fee_cents = CASE WHEN $25::boolean THEN $27::bigint ELSE cleaning_fee_cents END,
         updated_at = now()
       WHERE id = $1::uuid`,
      [
        resourceId,
        input.description !== undefined, input.description ?? null,
        input.visibility ?? null,
        input.audienceRelationshipTypes !== undefined, input.audienceRelationshipTypes ?? null,
        input.quantity ?? null,
        input.bookingApprovalMode ?? null,
        input.startHandoffMethod ?? null,
        input.endHandoffMethod ?? null,
        input.handoffTouched === true,
        input.deliveryRadiusKm ?? null,
        input.deliveryFeeCents ?? null,
        input.collectionFeeCents ?? null,
        input.handoffTimeTouched === true,
        input.handoffTimeStart ?? null,
        input.handoffTimeEnd ?? null,
        input.mileageTouched === true,
        input.mileagePolicy ?? null,
        input.includedKmPerDay ?? null,
        input.includedKmTotal ?? null,
        input.extraKmFeeCents ?? null,
        input.modalityTouched === true,
        input.rentalModality ?? null,
        input.cleaningTouched === true,
        input.cleaningFeePolicy ?? null,
        input.cleaningFeeCents ?? null,
      ]);
  }

  /** Substitui as faixas de preço do recurso (SSOT rental_resource_pricing). Dinheiro em cents/BIGINT.
   *  Idempotente: limpa e regrava as faixas ativas informadas. */
  async setPricingTiers(tenantId: string, resourceId: string, tiers: Array<{ unit: string; priceCents: number }>): Promise<void> {
    await runQueriesWithTenant(tenantId,
      `DELETE FROM rental_resource_pricing WHERE resource_id = $1::uuid`, [resourceId]);
    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i];
      await runQueriesWithTenant(tenantId,
        `INSERT INTO rental_resource_pricing (resource_id, unit, price_cents, sort_order)
         VALUES ($1::uuid, $2, $3::bigint, $4)
         ON CONFLICT (resource_id, unit) DO UPDATE SET price_cents = EXCLUDED.price_cents, sort_order = EXCLUDED.sort_order, updated_at = now()`,
        [resourceId, t.unit, t.priceCents, i]);
    }
  }

  /** Faixas de preço de um recurso (para projeção/estimativa). */
  async getPricingTiers(tenantId: string, resourceId: string): Promise<Array<{ unit: string; priceCents: number }>> {
    const rows = await runQueriesWithTenant<{ unit: string; price_cents: string }>(tenantId,
      `SELECT unit, price_cents FROM rental_resource_pricing WHERE resource_id = $1::uuid AND is_active ORDER BY sort_order ASC NULLS LAST`,
      [resourceId]);
    return rows.map((r) => ({ unit: r.unit, priceCents: Number(r.price_cents) }));
  }

  /** Faixas de preço de VÁRIOS recursos numa query (batch, para o card de "meus recursos" sem N+1). */
  async getPricingTiersForResources(tenantId: string, resourceIds: string[]): Promise<Map<string, Array<{ unit: string; priceCents: number }>>> {
    const out = new Map<string, Array<{ unit: string; priceCents: number }>>();
    if (resourceIds.length === 0) return out;
    const rows = await runQueriesWithTenant<{ resource_id: string; unit: string; price_cents: string }>(tenantId,
      `SELECT resource_id, unit, price_cents FROM rental_resource_pricing WHERE resource_id = ANY($1::uuid[]) AND is_active ORDER BY sort_order ASC NULLS LAST`,
      [resourceIds]);
    for (const r of rows) {
      const arr = out.get(r.resource_id) ?? [];
      arr.push({ unit: r.unit, priceCents: Number(r.price_cents) });
      out.set(r.resource_id, arr);
    }
    return out;
  }

  /** Reservas ATIVAS (requested + confirmed + checked_in) de um recurso, com status + subperíodo. Para o
   *  DONO ver pendentes E confirmadas (quem alugou). */
  async findActiveRequests(tenantId: string, resourceId: string): Promise<Array<{ bookingId: string; requesterActorId: string; status: string; bookedStart: Date | null; bookedEnd: Date | null; requestedAt: Date }>> {
    const rows = await runQueriesWithTenant<{ booking_id: string; requester_actor_id: string; status: string; booked_start_datetime: Date | null; booked_end_datetime: Date | null; requested_at: Date }>(tenantId,
      `SELECT b.booking_id, b.requester_actor_id, b.status, b.booked_start_datetime, b.booked_end_datetime, b.requested_at
         FROM bookings b
         JOIN availability a ON a.availability_id = b.availability_id AND a.tenant_id = b.tenant_id
        WHERE b.tenant_id = $1::uuid AND a.owner_type = 'rentable_resource' AND a.owner_id = $2::uuid
          AND b.status IN ('requested','confirmed','checked_in')
        ORDER BY (b.status='requested') DESC, b.requested_at ASC`,
      [tenantId, resourceId]);
    return rows.map((r) => ({ bookingId: r.booking_id, requesterActorId: r.requester_actor_id, status: r.status, bookedStart: r.booked_start_datetime, bookedEnd: r.booked_end_datetime, requestedAt: r.requested_at }));
  }

  /** MINHAS reservas (do consumidor): bookings do requester com recurso + dono + subperíodo + status. */
  async findMyBookings(tenantId: string, requesterActorId: string): Promise<Array<{ bookingId: string; status: string; resourceId: string; resourceLabel: string; resourceType: string; ownerActorId: string; bookedStart: Date | null; bookedEnd: Date | null; requestedAt: Date }>> {
    const rows = await runQueriesWithTenant<any>(tenantId,
      `SELECT b.booking_id, b.status, r.id AS resource_id, r.label AS resource_label, r.resource_type, r.owner_actor_id,
              b.booked_start_datetime, b.booked_end_datetime, b.requested_at
         FROM bookings b
         JOIN availability a ON a.availability_id = b.availability_id AND a.tenant_id = b.tenant_id
         JOIN rentable_resources r ON r.id = a.owner_id
        WHERE b.tenant_id = $1::uuid AND a.owner_type = 'rentable_resource' AND b.requester_actor_id = $2::uuid
          AND b.status IN ('requested','confirmed','checked_in','checked_out','cancelled')
        ORDER BY b.requested_at DESC`,
      [tenantId, requesterActorId]);
    return rows.map((r) => ({ bookingId: r.booking_id, status: r.status, resourceId: r.resource_id, resourceLabel: r.resource_label, resourceType: r.resource_type, ownerActorId: r.owner_actor_id, bookedStart: r.booked_start_datetime, bookedEnd: r.booked_end_datetime, requestedAt: r.requested_at }));
  }

  /** RESERVAS RECEBIDAS pelo DONO (todos os recursos dele) — para o painel do operar agrupar por status. */
  async findBookingsForOwner(tenantId: string, ownerActorId: string): Promise<Array<{ bookingId: string; status: string; resourceId: string; resourceLabel: string; resourceType: string; requesterActorId: string; bookedStart: Date | null; bookedEnd: Date | null; requestedAt: Date }>> {
    const rows = await runQueriesWithTenant<any>(tenantId,
      `SELECT b.booking_id, b.status, r.id AS resource_id, r.label AS resource_label, r.resource_type,
              b.requester_actor_id, b.booked_start_datetime, b.booked_end_datetime, b.requested_at
         FROM bookings b
         JOIN availability a ON a.availability_id = b.availability_id AND a.tenant_id = b.tenant_id
         JOIN rentable_resources r ON r.id = a.owner_id
        WHERE b.tenant_id = $1::uuid AND a.owner_type = 'rentable_resource' AND r.owner_actor_id = $2::uuid
          AND b.status IN ('requested','confirmed','checked_in','checked_out','cancelled')
        ORDER BY (b.status='requested') DESC, b.requested_at DESC`,
      [tenantId, ownerActorId]);
    return rows.map((r) => ({ bookingId: r.booking_id, status: r.status, resourceId: r.resource_id, resourceLabel: r.resource_label, resourceType: r.resource_type, requesterActorId: r.requester_actor_id, bookedStart: r.booked_start_datetime, bookedEnd: r.booked_end_datetime, requestedAt: r.requested_at }));
  }

  /** Cidade ATIVA vinculada ao recurso (id + nome+uf) — para preencher o form de edição. */
  async getResourceCity(tenantId: string, resourceId: string): Promise<{ cityId: string; name: string; uf: string | null } | null> {
    const rows = await runQueriesWithTenant<{ city_id: string; name: string; abbreviation: string | null }>(tenantId,
      `SELECT a.city_id, c.name, s.abbreviation FROM address_assignments aa
         JOIN addresses a ON a.address_id = aa.address_id
         JOIN cities c ON c.city_id = a.city_id
         LEFT JOIN states s ON s.state_id = c.state_id
        WHERE aa.owner_type = 'rentable_resource' AND aa.role = 'PICKUP'
          AND aa.is_primary = true AND aa.valid_until_at IS NULL AND aa.owner_id = $1::uuid LIMIT 1`,
      [resourceId]);
    const r = rows[0];
    return r ? { cityId: r.city_id, name: r.name, uf: r.abbreviation } : null;
  }

  /**
   * Busca de locação por TEXTO para a busca GLOBAL/omni. Só recursos PÚBLICOS ativos (DECISION-0113:
   * a busca global não usa actor declarado pelo cliente — recursos de plateia restrita só aparecem na
   * descoberta /discover, que tem viewer server-side). Retorna id/label/tipo/cidade (sem rua).
   */
  async searchByText(tenantId: string, q: string, limit = 8): Promise<Array<{ id: string; label: string; resourceType: string; cityName: string | null; uf: string | null }>> {
    const rows = await runQueriesWithTenant<{ id: string; label: string; resource_type: string; city_name: string | null; uf: string | null }>(
      tenantId,
      `SELECT r.id::text, r.label, r.resource_type, c.name AS city_name, s.abbreviation AS uf
         FROM rentable_resources r
         LEFT JOIN address_assignments aa ON aa.owner_type='rentable_resource' AND aa.owner_id=r.id
              AND aa.role='PICKUP' AND aa.is_primary=true AND aa.valid_until_at IS NULL
         LEFT JOIN addresses ad ON ad.address_id=aa.address_id
         LEFT JOIN cities c ON c.city_id=ad.city_id
         LEFT JOIN states s ON s.state_id=c.state_id
        WHERE r.tenant_id=$1::uuid AND r.status='active' AND r.visibility='public'
          AND r.label ILIKE '%'||$2||'%'
        ORDER BY r.created_at DESC LIMIT $3`,
      [tenantId, q, Math.min(Math.max(limit, 1), 20)]);
    return rows.map((r) => ({ id: r.id, label: r.label, resourceType: r.resource_type, cityName: r.city_name, uf: r.uf }));
  }

  /** Projeção PÚBLICA de um actor (mesmos campos seguros de searchPublicActors — anti-PII por construção:
   *  nunca user_id/global_user_id/cpf/documento). Para o dono ver QUEM solicitou antes de confirmar. */
  async getPublicActorSummary(tenantId: string, actorId: string): Promise<{ actorId: string; displayName: string; actorType: string; avatarUrl: string | null } | null> {
    const row = await runQueryWithTenant<{ id: string; display_name: string; avatar_url: string | null; actor_type: string }>(
      tenantId,
      `SELECT id, display_name, avatar_url, actor_type FROM actors WHERE id = $1::uuid AND tenant_id = $2::uuid LIMIT 1`,
      [actorId, tenantId]);
    if (!row) return null;
    return { actorId: row.id, displayName: row.display_name, actorType: row.actor_type, avatarUrl: row.avatar_url };
  }

  /** Solicitações PENDENTES (status requested) de um recurso, com o subperíodo pedido. O service valida
   *  autoridade do dono ANTES. Ordena por mais antigas primeiro (fila justa). */
  async findPendingRequests(tenantId: string, resourceId: string): Promise<Array<{ bookingId: string; requesterActorId: string; bookedStart: Date | null; bookedEnd: Date | null; requestedAt: Date }>> {
    const rows = await runQueriesWithTenant<{ booking_id: string; requester_actor_id: string; booked_start_datetime: Date | null; booked_end_datetime: Date | null; requested_at: Date }>(
      tenantId,
      `SELECT b.booking_id, b.requester_actor_id, b.booked_start_datetime, b.booked_end_datetime, b.requested_at
         FROM bookings b
         JOIN availability a ON a.availability_id = b.availability_id AND a.tenant_id = b.tenant_id
        WHERE b.tenant_id = $1::uuid AND a.owner_type = 'rentable_resource' AND a.owner_id = $2::uuid
          AND b.status = 'requested'
        ORDER BY b.requested_at ASC`,
      [tenantId, resourceId]);
    return rows.map((r) => ({ bookingId: r.booking_id, requesterActorId: r.requester_actor_id, bookedStart: r.booked_start_datetime, bookedEnd: r.booked_end_datetime, requestedAt: r.requested_at }));
  }

  /** Subperíodos OCUPADOS (reservas confirmadas/em-uso) de um recurso — para projetar a disponibilidade
   *  restante (janela macro menos reservas). COALESCE(subperíodo, janela) para reservas sem subperíodo. */
  async findConfirmedPeriods(tenantId: string, resourceId: string): Promise<Array<{ start: Date; end: Date }>> {
    const rows = await runQueriesWithTenant<{ s: Date; e: Date }>(tenantId,
      `SELECT COALESCE(b.booked_start_datetime, a.start_datetime) AS s,
              COALESCE(b.booked_end_datetime, a.end_datetime) AS e
         FROM bookings b
         JOIN availability a ON a.availability_id = b.availability_id AND a.tenant_id = b.tenant_id
        WHERE b.tenant_id = $1::uuid AND a.owner_type = 'rentable_resource' AND a.owner_id = $2::uuid
          AND b.status IN ('confirmed','checked_in','checked_out')
        ORDER BY s ASC`,
      [tenantId, resourceId]);
    return rows.map((r) => ({ start: new Date(r.s), end: new Date(r.e) }));
  }

  /** Coordenada canônica de uma cidade (SSOT cities). Origem do consumidor na busca por proximidade —
   *  o front nunca manda lat/lng; o backend resolve da cidade escolhida. */
  async cityCoord(cityId: string): Promise<{ lat: number; lng: number } | null> {
    const row = await runQueryWithTenant<{ lat: string | null; lng: string | null }>(
      'public', `SELECT lat, lng FROM cities WHERE city_id = $1::uuid AND is_active LIMIT 1`, [cityId]);
    if (!row || row.lat == null || row.lng == null) return null;
    return { lat: Number(row.lat), lng: Number(row.lng) };
  }

  /** cidade existe na SSOT canônica? (o front nunca inventa cidade — backend valida) */
  async cityExists(cityId: string): Promise<boolean> {
    const row = await runQueryWithTenant<{ city_id: string }>(
      'public', `SELECT city_id FROM cities WHERE city_id = $1::uuid AND is_active LIMIT 1`, [cityId]);
    return !!row;
  }

  /**
   * F-RENTABLE-RESOURCE-LOCATION-MVP: vincula a CIDADE ao recurso pelo padrão canônico
   * address_assignments → addresses → cities (SSOT). NÃO cria city_name livre. Endereço NÍVEL-CIDADE
   * (só cidade; rua/número ficam p/ fluxo autorizado futuro — privacidade por construção na vitrine).
   * country_id/state_id são DERIVADOS da própria cidade (não hardcode do Brasil). Regra: 1 PICKUP
   * primário por recurso (retirada=devolução no mesmo local).
   */
  async assignCityToResource(
    tenantId: string, resourceId: string, cityId: string,
    opts?: { postalCode?: string | null; lat?: number | null; lng?: number | null }
  ): Promise<void> {
    // Regra "1 local ativo" imposta pelo índice único parcial (owner_type,owner_id,role) WHERE
    // is_primary AND valid_until_at IS NULL. 2 passos (não CTE — DELETE/INSERT no mesmo CTE dividem
    // snapshot e colidem no índice): 1) EXPIRA o pickup ativo anterior (preserva histórico de onde o
    // recurso esteve); 2) cria address nível-cidade + novo assignment primário.
    // Fase 4: o address ganha lat/lng — do CEP resolvido (opts) quando houver, senão a COORD DA CIDADE
    // (cities.lat/lng, sempre disponível, sem rede). Habilita o filtro por raio sem expor rua/número.
    await runQueriesWithTenant(tenantId,
      `UPDATE address_assignments SET valid_until_at = now(), is_primary = false, updated_at = now()
        WHERE owner_type = 'rentable_resource' AND owner_id = $1::uuid AND role = 'PICKUP'
          AND is_primary = true AND valid_until_at IS NULL`, [resourceId]);
    await runQueriesWithTenant(tenantId,
      `WITH geo AS (
         SELECT c.state_id, s.country_id, c.lat AS city_lat, c.lng AS city_lng
           FROM cities c JOIN states s ON s.state_id = c.state_id WHERE c.city_id = $2::uuid
       ),
       new_addr AS (
         INSERT INTO addresses (country_id, state_id, city_id, postal_code, lat, lng, is_geocoded, source, created_by_tenant_id)
         SELECT geo.country_id, geo.state_id, $2::uuid, $4,
                COALESCE($5::numeric, geo.city_lat), COALESCE($6::numeric, geo.city_lng),
                false, 'UX_INPUT', $3::uuid FROM geo
         RETURNING address_id
       )
       INSERT INTO address_assignments (owner_type, owner_id, address_id, role, is_primary)
       SELECT 'rentable_resource', $1::uuid, address_id, 'PICKUP', true FROM new_addr`,
      [resourceId, cityId, tenantId, opts?.postalCode ?? null, opts?.lat ?? null, opts?.lng ?? null]);
  }

  /**
   * Endereço COMPLETO do recurso (transversal — imóvel usa rua/número; veículo/equip usam como base de
   * retirada). Grava street/number/complement/neighborhood em `addresses` (tabela já suporta) + assignment
   * primário. Mesmo padrão "1 local ativo": expira o PICKUP anterior (preserva histórico) e insere o novo.
   * neighborhood: FK canônica (neighborhood_id) quando resolvida; senão só display-text (não vira SSOT).
   */
  async assignAddressToResource(
    tenantId: string, resourceId: string,
    a: { cityId: string; postalCode?: string | null; street?: string | null; number?: string | null;
         complement?: string | null; neighborhoodId?: string | null; neighborhoodDisplay?: string | null;
         lat?: number | null; lng?: number | null }
  ): Promise<void> {
    await runQueriesWithTenant(tenantId,
      `UPDATE address_assignments SET valid_until_at = now(), is_primary = false, updated_at = now()
        WHERE owner_type = 'rentable_resource' AND owner_id = $1::uuid AND role = 'PICKUP'
          AND is_primary = true AND valid_until_at IS NULL`, [resourceId]);
    await runQueriesWithTenant(tenantId,
      `WITH geo AS (
         SELECT c.state_id, s.country_id, c.lat AS city_lat, c.lng AS city_lng
           FROM cities c JOIN states s ON s.state_id = c.state_id WHERE c.city_id = $2::uuid
       ),
       new_addr AS (
         INSERT INTO addresses (country_id, state_id, city_id, neighborhood_id, postal_code, street, number,
                                complement, neighborhood_display_text, lat, lng, is_geocoded, source, created_by_tenant_id)
         SELECT geo.country_id, geo.state_id, $2::uuid, $5::uuid, $4, $6, $7, $8, $9,
                COALESCE($10::numeric, geo.city_lat), COALESCE($11::numeric, geo.city_lng),
                false, 'UX_INPUT', $3::uuid FROM geo
         RETURNING address_id
       )
       INSERT INTO address_assignments (owner_type, owner_id, address_id, role, is_primary)
       SELECT 'rentable_resource', $1::uuid, address_id, 'PICKUP', true FROM new_addr`,
      [resourceId, a.cityId, tenantId, a.postalCode ?? null, a.neighborhoodId ?? null,
       a.street ?? null, a.number ?? null, a.complement ?? null, a.neighborhoodDisplay ?? null,
       a.lat ?? null, a.lng ?? null]);
  }

  /** Atualiza o metadata (facets/atributos tipados da oferta — ex.: tempo mínimo). jsonb inteiro. */
  async updateMetadata(tenantId: string, resourceId: string, metadata: Record<string, unknown>): Promise<void> {
    await runQueriesWithTenant(tenantId,
      `UPDATE rentable_resources SET metadata = $2::jsonb, updated_at = now() WHERE id = $1::uuid`,
      [resourceId, JSON.stringify(metadata)]);
  }

  /** Endereço COMPLETO ativo do recurso (rua/número/complemento/bairro). SÓ para quem tem autoridade
   *  (dono ou locatário confirmado) — a autoridade é checada no SERVICE, não aqui. Privacidade: este
   *  método existe separado do projetor público justamente para o full-address nunca vazar por engano. */
  async getResourceFullAddress(tenantId: string, resourceId: string): Promise<{
    street: string | null; number: string | null; complement: string | null;
    neighborhood: string | null; city: string | null; uf: string | null; postalCode: string | null;
  } | null> {
    const rows = await runQueriesWithTenant<any>(tenantId,
      `SELECT ad.street, ad.number, ad.complement, ad.postal_code,
              COALESCE(n.name, ad.neighborhood_display_text) AS neighborhood,
              c.name AS city, s.abbreviation AS uf
         FROM address_assignments aa
         JOIN addresses ad ON ad.address_id = aa.address_id
         LEFT JOIN cities c ON c.city_id = ad.city_id
         LEFT JOIN states s ON s.state_id = ad.state_id
         LEFT JOIN neighborhoods n ON n.neighborhood_id = ad.neighborhood_id
        WHERE aa.owner_type = 'rentable_resource' AND aa.owner_id = $1::uuid
          AND aa.role = 'PICKUP' AND aa.is_primary = true AND aa.valid_until_at IS NULL
        LIMIT 1`,
      [resourceId]);
    const r = rows[0];
    return r ? { street: r.street, number: r.number, complement: r.complement, neighborhood: r.neighborhood, city: r.city, uf: r.uf, postalCode: r.postal_code } : null;
  }

  /** O viewer (actor) tem reserva CONFIRMADA/em-uso deste recurso? (libera o endereço completo). */
  async viewerHasConfirmedBooking(tenantId: string, resourceId: string, viewerActorId: string): Promise<boolean> {
    const rows = await runQueriesWithTenant<{ n: number }>(tenantId,
      `SELECT count(*)::int n FROM bookings b
         JOIN availability a ON a.availability_id = b.availability_id AND a.tenant_id = b.tenant_id
        WHERE b.tenant_id = $1::uuid AND a.owner_type='rentable_resource' AND a.owner_id=$2::uuid
          AND b.requester_actor_id = $3::uuid AND b.status IN ('confirmed','checked_in','checked_out')`,
      [tenantId, resourceId, viewerActorId]);
    return (rows[0]?.n ?? 0) > 0;
  }

  /** Cidade projetada do recurso (cidade + UF) — para listagem/vitrine. SEM rua/número (privacidade). */
  async getResourceCities(tenantId: string, resourceIds: string[]): Promise<Map<string, { city: string; uf: string | null }>> {
    if (resourceIds.length === 0) return new Map();
    const rows = await runQueriesWithTenant<{ owner_id: string; name: string; abbreviation: string | null }>(
      tenantId,
      `SELECT aa.owner_id, c.name, s.abbreviation
         FROM address_assignments aa
         JOIN addresses a ON a.address_id = aa.address_id
         JOIN cities c ON c.city_id = a.city_id
         LEFT JOIN states s ON s.state_id = c.state_id
        WHERE aa.owner_type = 'rentable_resource' AND aa.role = 'PICKUP'
          AND aa.is_primary = true AND aa.valid_until_at IS NULL
          AND aa.owner_id = ANY($1::uuid[])`,
      [resourceIds]);
    const m = new Map<string, { city: string; uf: string | null }>();
    rows.forEach((r) => m.set(r.owner_id, { city: r.name, uf: r.abbreviation }));
    return m;
  }
}

export const rentableResourceRepository = new RentableResourceRepository();
