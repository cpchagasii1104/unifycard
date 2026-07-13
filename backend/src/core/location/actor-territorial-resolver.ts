// FASE A — RESOLVER READ-ONLY da jurisdição territorial canônica do Actor.
// ADDRESS → CITY/NEIGHBORHOOD CANONICAL BINDING.
//
// Responde SÓ à pergunta pedida (purpose → role), consultando UNICAMENTE o assignment actor-scoped
// vigente primary na casa canônica (address_assignments.owner_type='actor'). Estados honestos, fail-closed.
//
// NUNCA: escreve; consulta CEP/provider; infere por texto/display_text; usa actor_active_location;
// usa profile/company/tenant/representante como fallback; escolhe "qualquer endereço"; toca Bank/Social.
// Não abre rota HTTP. Bank/Social definirão depois qual purpose consomem — aqui só respondemos.

import { getClientWithTenant } from '@core/database/pool';

export type ActorTerritorialPurpose = 'ACTOR_RESIDENCE' | 'ACTOR_OPERATIONAL' | 'ACTOR_FISCAL_HQ';

const PURPOSE_ROLE: Record<ActorTerritorialPurpose, 'RESIDENCE' | 'OPERATIONAL' | 'HQ'> = {
  ACTOR_RESIDENCE: 'RESIDENCE',
  ACTOR_OPERATIONAL: 'OPERATIONAL',
  ACTOR_FISCAL_HQ: 'HQ',
};

export type ActorTerritorialState =
  | 'resolved_city_and_neighborhood'
  | 'resolved_city_neighborhood_pending'
  | 'territorial_address_missing'
  | 'canonical_city_missing'
  | 'ambiguous_active_assignment'
  | 'role_not_applicable'
  | 'actor_not_found';

export interface ActorTerritory {
  state: ActorTerritorialState;
  actorId: string;
  role: 'RESIDENCE' | 'OPERATIONAL' | 'HQ' | null;
  addressId: string | null;
  cityId: string | null;
  neighborhoodId: string | null;
  effectiveAt: string | null;
}

/**
 * Resolve a jurisdição territorial vigente do Actor para um purpose governado.
 * Read-only, fail-closed, sem fallback. tenantId (contexto de auth) + actorId são explícitos.
 * Usa client tenant-scoped governado (RLS): `actors` é RLS; addresses/address_assignments não.
 */
export async function resolveActorTerritory(
  tenantId: string,
  actorId: string,
  purpose: ActorTerritorialPurpose,
): Promise<ActorTerritory> {
  const role = PURPOSE_ROLE[purpose] ?? null;
  const base: ActorTerritory = {
    state: 'role_not_applicable',
    actorId,
    role,
    addressId: null,
    cityId: null,
    neighborhoodId: null,
    effectiveAt: null,
  };
  if (!role) return base;

  const client = await getClientWithTenant(tenantId);
  try {
    const actor = await client.query('SELECT 1 FROM actors WHERE id = $1', [actorId]);
    if (actor.rows.length === 0) return { ...base, state: 'actor_not_found' };

    // SÓ o assignment actor-scoped vigente primary — nenhum fallback (profile/company/active_location/CEP/texto).
    const r = await client.query<{
      address_id: string;
      city_id: string | null;
      neighborhood_id: string | null;
      valid_from_at: string;
    }>(
      `SELECT aa.address_id, a.city_id, a.neighborhood_id, aa.valid_from_at
         FROM address_assignments aa
         JOIN addresses a ON a.address_id = aa.address_id
        WHERE aa.owner_type = 'actor'
          AND aa.actor_id = $1
          AND aa.role = $2
          AND aa.is_primary = true
          AND aa.valid_until_at IS NULL`,
      [actorId, role],
    );

    if (r.rows.length === 0) return { ...base, state: 'territorial_address_missing' };
    // Defensivo: a UNIQUE parcial (actor_id, role) WHERE is_primary AND valid_until_at IS NULL garante <=1.
    if (r.rows.length > 1) return { ...base, state: 'ambiguous_active_assignment' };

    const row = r.rows[0];
    const out: ActorTerritory = {
      ...base,
      addressId: row.address_id,
      cityId: row.city_id,
      neighborhoodId: row.neighborhood_id,
      effectiveAt: row.valid_from_at,
    };
    if (!row.city_id) return { ...out, cityId: null, neighborhoodId: null, state: 'canonical_city_missing' };
    if (!row.neighborhood_id) return { ...out, state: 'resolved_city_neighborhood_pending' };
    return { ...out, state: 'resolved_city_and_neighborhood' };
  } finally {
    client.release();
  }
}
