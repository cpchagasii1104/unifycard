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
         (tenant_id, owner_actor_id, concept_id, resource_type, label, description, category_id, pricing_unit, price_cents, resource_year, metadata, visibility, audience_relationship_types, quantity)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7::uuid, $8, $9, $10, $11::jsonb, $12, $13::text[], $14::int)
       RETURNING id, tenant_id, owner_actor_id, concept_id, resource_type, label, description, pricing_unit, price_cents,
                 category_id, status, is_active, resource_year, metadata, visibility, audience_relationship_types, quantity, created_at, updated_at`,
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
      ]
    );
    if (!row) throw new Error('Falha ao criar rentable_resource');
    return toDomain(row);
  }

  async findById(tenantId: string, id: string): Promise<RentableResource | null> {
    const row = await runQueryWithTenant<RentableResourceRow>(
      tenantId,
      `SELECT id, tenant_id, owner_actor_id, concept_id, resource_type, label, description, pricing_unit, price_cents,
              category_id, status, is_active, resource_year, metadata, visibility, audience_relationship_types, quantity, created_at, updated_at
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
              category_id, status, is_active, resource_year, metadata, visibility, audience_relationship_types, quantity, created_at, updated_at
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
                  category_id, status, is_active, resource_year, metadata, visibility, audience_relationship_types, quantity, created_at, updated_at`,
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
  }): Promise<void> {
    await runQueriesWithTenant(tenantId,
      `UPDATE rentable_resources SET
         description = CASE WHEN $2::boolean THEN $3 ELSE description END,
         visibility = COALESCE($4, visibility),
         audience_relationship_types = CASE WHEN $5::boolean THEN $6::text[] ELSE audience_relationship_types END,
         quantity = COALESCE($7::int, quantity),
         updated_at = now()
       WHERE id = $1::uuid`,
      [
        resourceId,
        input.description !== undefined, input.description ?? null,
        input.visibility ?? null,
        input.audienceRelationshipTypes !== undefined, input.audienceRelationshipTypes ?? null,
        input.quantity ?? null,
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
