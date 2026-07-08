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
         (tenant_id, owner_actor_id, concept_id, resource_type, label, description, category_id, pricing_unit, price_cents, resource_year, metadata, visibility, audience_relationship_types)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7::uuid, $8, $9, $10, $11::jsonb, $12, $13::text[])
       RETURNING id, tenant_id, owner_actor_id, concept_id, resource_type, label, description, pricing_unit, price_cents,
                 category_id, status, is_active, resource_year, metadata, visibility, audience_relationship_types, created_at, updated_at`,
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
      ]
    );
    if (!row) throw new Error('Falha ao criar rentable_resource');
    return toDomain(row);
  }

  async findById(tenantId: string, id: string): Promise<RentableResource | null> {
    const row = await runQueryWithTenant<RentableResourceRow>(
      tenantId,
      `SELECT id, tenant_id, owner_actor_id, concept_id, resource_type, label, description, pricing_unit, price_cents,
              category_id, status, is_active, resource_year, metadata, visibility, audience_relationship_types, created_at, updated_at
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
              category_id, status, is_active, resource_year, metadata, visibility, audience_relationship_types, created_at, updated_at
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
              r.metadata, r.visibility, r.audience_relationship_types, r.created_at, r.updated_at
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
                  category_id, status, is_active, resource_year, metadata, visibility, audience_relationship_types, created_at, updated_at`,
      [id, tenantId, status]
    );
    return row ? toDomain(row) : null;
  }

  async conceptExists(tenantId: string, conceptId: string): Promise<boolean> {
    const row = await runQueryWithTenant<{ concept_id: string }>(
      tenantId,
      `SELECT concept_id FROM concepts WHERE concept_id = $1::uuid LIMIT 1`,
      [conceptId]
    );
    return !!row;
  }
}

export const rentableResourceRepository = new RentableResourceRepository();
