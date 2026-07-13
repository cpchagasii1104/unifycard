// F-ADDRESS-ONBOARDING-CANONICAL-FLOW (RFC A1-D) — READ-MODEL fino do endereço territorial vigente.
//
// Reutiliza o resolver READ-ONLY selado da Fase A (resolveActorTerritory) e ENRIQUECE os IDs por
// Location Core (nomes de country/state/city/neighborhood + campos físicos do address vigente).
// NÃO resolve por texto, NÃO chama provider, NÃO escreve, NÃO retorna histórico completo, NÃO
// funciona tenant-only (exige actorId). Autoridade (canRepresentActor) fica na ROTA.

import { getClientWithTenant } from '@core/database/pool';
import { resolveActorTerritory, type ActorTerritorialPurpose } from './actor-territorial-resolver';
import type { TerritorialAddressCurrent } from '@unificard/contracts';

export class ActorTerritorialAddressReadService {
  /**
   * Endereço territorial vigente do Actor (MVP: ACTOR_RESIDENCE). Retorna projeção segura none/active.
   */
  async getCurrent(
    tenantId: string,
    actorId: string,
    purpose: ActorTerritorialPurpose,
  ): Promise<TerritorialAddressCurrent> {
    // MVP: só residência.
    const territory = await resolveActorTerritory(tenantId, actorId, purpose);
    const base = { actorId, purpose: 'ACTOR_RESIDENCE' as const, role: 'RESIDENCE' as const };

    // Estados sem endereço actor-scoped vigente → 'none' (honesto, sem vazar sub-estado interno).
    if (
      territory.state === 'territorial_address_missing' ||
      territory.state === 'actor_not_found' ||
      territory.state === 'role_not_applicable' ||
      territory.state === 'ambiguous_active_assignment' ||
      !territory.addressId
    ) {
      return { state: 'none', ...base };
    }

    // Enriquecimento por Location Core (nomes + físicos) do address vigente.
    const client = await getClientWithTenant(tenantId);
    try {
      const r = await client.query<{
        postal_code: string | null; street: string | null; number: string | null; complement: string | null;
        country_id: string | null; country_name: string | null;
        state_id: string | null; state_code: string | null; state_name: string | null;
        city_id: string | null; city_name: string | null;
        neighborhood_id: string | null; neighborhood_name: string | null;
      }>(
        `SELECT a.postal_code, a.street, a.number, a.complement,
                a.country_id, co.name AS country_name,
                a.state_id, s.abbreviation AS state_code, s.name AS state_name,
                a.city_id, c.name AS city_name,
                a.neighborhood_id, n.name AS neighborhood_name
           FROM addresses a
           LEFT JOIN countries co ON co.country_id = a.country_id
           LEFT JOIN states s ON s.state_id = a.state_id
           LEFT JOIN cities c ON c.city_id = a.city_id
           LEFT JOIN neighborhoods n ON n.neighborhood_id = a.neighborhood_id
          WHERE a.address_id = $1`,
        [territory.addressId],
      );
      const row = r.rows[0];
      if (!row) return { state: 'none', ...base };

      return {
        state: 'active',
        ...base,
        addressId: territory.addressId,
        country: row.country_id ? { id: row.country_id, displayName: row.country_name ?? '' } : null,
        state_: row.state_id ? { id: row.state_id, code: row.state_code ?? '', displayName: row.state_name ?? '' } : null,
        city: row.city_id ? { id: row.city_id, displayName: row.city_name ?? '' } : null,
        neighborhood: row.neighborhood_id ? { id: row.neighborhood_id, displayName: row.neighborhood_name ?? '' } : null,
        postalCode: row.postal_code,
        street: row.street,
        number: row.number,
        complement: row.complement,
        effectiveAt: territory.effectiveAt,
        source: 'actor_scoped',
      };
    } finally {
      client.release();
    }
  }
}

export const actorTerritorialAddressReadService = new ActorTerritorialAddressReadService();
