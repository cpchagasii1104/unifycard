// FASE C — repository PRIVADO de mutação actor-territorial (casa única).
// ADDRESS → CITY/NEIGHBORHOOD CANONICAL BINDING.
//
// SÓ pode ser chamado pelo service canônico actor-territorial-address-writer. Todas as funções EXIGEM um
// PoolClient transacional (getClientWithTenant + BEGIN) — nenhuma abre conexão própria, nenhuma valida
// autoridade, nenhuma aceita owner_type/role arbitrários. As constraints/triggers da Fase A (shape,
// coerência PF/PJ, unicidade, imutabilidade) fazem o enforcement estrutural. Não exportar por barrel.

import type { PoolClient } from 'pg';

export type ActorTerritorialRole = 'RESIDENCE' | 'OPERATIONAL' | 'HQ';

export interface TerritorialAddressInput {
  countryId: string;
  stateId?: string | null;
  cityId?: string | null;
  neighborhoodId?: string | null;
  neighborhoodDisplayText?: string | null;
  postalCode?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  reference?: string | null;
}

/** Cria o registro físico em addresses (source fixa UX_INPUT; sem lat/lng; created_by_tenant_id auditoria). */
export async function createTerritorialAddress(
  client: PoolClient,
  data: TerritorialAddressInput,
  createdByTenantId: string,
): Promise<string> {
  const r = await client.query<{ address_id: string }>(
    `INSERT INTO addresses (
       country_id, state_id, city_id, neighborhood_id, neighborhood_display_text,
       postal_code, street, number, complement, reference,
       source, lat, lng, is_geocoded, created_by_tenant_id
     ) VALUES ($1,$2,$3,$4,$5, $6,$7,$8,$9,$10, 'UX_INPUT', NULL, NULL, false, $11)
     RETURNING address_id`,
    [
      data.countryId, data.stateId ?? null, data.cityId ?? null, data.neighborhoodId ?? null,
      data.neighborhoodDisplayText ?? null, data.postalCode ?? null, data.street ?? null,
      data.number ?? null, data.complement ?? null, data.reference ?? null, createdByTenantId,
    ],
  );
  return r.rows[0].address_id;
}

/** Encerra (soft) o assignment actor-scoped vigente primary para (actorId, role). Retorna o anterior, se havia. */
export async function retirePriorActorPrimary(
  client: PoolClient,
  actorId: string,
  role: ActorTerritorialRole,
): Promise<{ assignmentId: string; addressId: string } | null> {
  const r = await client.query<{ assignment_id: string; address_id: string }>(
    `UPDATE address_assignments
        SET valid_until_at = now(), is_primary = false, updated_at = now()
      WHERE owner_type = 'actor' AND actor_id = $1 AND role = $2
        AND is_primary = true AND valid_until_at IS NULL
      RETURNING assignment_id, address_id`,
    [actorId, role],
  );
  return r.rows.length ? { assignmentId: r.rows[0].assignment_id, addressId: r.rows[0].address_id } : null;
}

/** Insere o novo vínculo actor-scoped primary vigente (owner_id espelho de actor_id; is_primary=true). */
export async function insertActorAssignment(
  client: PoolClient,
  actorId: string,
  addressId: string,
  role: ActorTerritorialRole,
): Promise<string> {
  const r = await client.query<{ assignment_id: string }>(
    `INSERT INTO address_assignments (owner_type, owner_id, address_id, role, is_primary, actor_id)
     VALUES ('actor', $1, $2, $3, true, $1)
     RETURNING assignment_id`,
    [actorId, addressId, role],
  );
  return r.rows[0].assignment_id;
}

/** Registra o evento append-only na casa canônica actor_events (mutation primeiro, evento depois, mesma tx). */
export async function insertTerritorialEvent(
  client: PoolClient,
  ev: {
    tenantId: string;
    actorId: string;
    eventType: 'actor_territorial_address_set' | 'actor_territorial_address_replaced' | 'actor_territorial_address_retired';
    referenceId: string | null;
    metadata: Record<string, unknown>;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO actor_events (tenant_id, actor_id, event_type, reference_id, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [ev.tenantId, ev.actorId, ev.eventType, ev.referenceId, JSON.stringify(ev.metadata)],
  );
}
