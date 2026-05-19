// src/core/location/actor-active-location.repository.ts
// DECISION-0030 — Localização contextual de actor (F2 do plano feed geo)
//
// Repository para actor_active_location.
// SSOT: dado privado RLS-protected (LGPD). Sempre via runQueryWithTenant.

import { runQueryWithTenant } from '@core/database/pool';
import type {
  ActorActiveLocation,
  ActorActiveLocationHydrated,
  SetActorActiveLocationInput,
} from './feed-proximity.types';

interface ActorActiveLocationRow {
  id: string;
  tenant_id: string;
  actor_id: string;
  address_id: string | null;
  lat: string | null; // NUMERIC vem como string do node-pg
  lng: string | null;
  source: string;
  scope_level: string | null;
  activated_at: Date | string;
  expires_at: Date | string | null;
  is_active: boolean;
  metadata: any;
  created_at: Date | string;
}

interface ActorActiveLocationHydratedRow extends ActorActiveLocationRow {
  city_id: string | null;
  state_id: string | null;
  country_id: string | null;
}

function toIso(v: Date | string | null): string {
  if (v === null) return null as unknown as string;
  return v instanceof Date ? v.toISOString() : String(v);
}

function parseNumeric(v: string | null): number | null {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toModel(row: ActorActiveLocationRow): ActorActiveLocation {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    actorId: row.actor_id,
    addressId: row.address_id,
    lat: parseNumeric(row.lat),
    lng: parseNumeric(row.lng),
    source: row.source as ActorActiveLocation['source'],
    scopeLevel: row.scope_level as ActorActiveLocation['scopeLevel'],
    activatedAt: toIso(row.activated_at),
    expiresAt: row.expires_at !== null ? toIso(row.expires_at) : null,
    isActive: row.is_active,
    metadata: row.metadata || {},
    createdAt: toIso(row.created_at),
  };
}

function toHydratedModel(row: ActorActiveLocationHydratedRow): ActorActiveLocationHydrated {
  return {
    ...toModel(row),
    cityId: row.city_id,
    stateId: row.state_id,
    countryId: row.country_id,
  };
}

class ActorActiveLocationRepository {
  /**
   * Busca localização ativa do actor (apenas onde is_active=true).
   * Retorna null se actor não tem localização ativa.
   */
  async getActive(tenantId: string, actorId: string): Promise<ActorActiveLocation | null> {
    const row = await runQueryWithTenant<ActorActiveLocationRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, address_id, lat::text AS lat, lng::text AS lng,
             source, scope_level, activated_at, expires_at, is_active, metadata, created_at
      FROM actor_active_location
      WHERE tenant_id = $1 AND actor_id = $2 AND is_active = true
      LIMIT 1
      `,
      [tenantId, actorId]
    );
    return row ? toModel(row) : null;
  }

  /**
   * Busca localização ativa HIDRATADA — JOIN com addresses para resolver city_id/state_id/country_id.
   * Usado pelo feed-proximity para scope='city' e scope='state'.
   *
   * Quando address_id é NULL (só lat/lng), retorna cityId/stateId/countryId NULL — caller
   * deve fallback para resolver via lat/lng (worldService) OU degradar para scope.
   */
  async getActiveHydrated(
    tenantId: string,
    actorId: string
  ): Promise<ActorActiveLocationHydrated | null> {
    const row = await runQueryWithTenant<ActorActiveLocationHydratedRow>(
      tenantId,
      `
      SELECT aal.id, aal.tenant_id, aal.actor_id, aal.address_id,
             aal.lat::text AS lat, aal.lng::text AS lng,
             aal.source, aal.scope_level, aal.activated_at, aal.expires_at,
             aal.is_active, aal.metadata, aal.created_at,
             a.city_id, a.state_id, a.country_id
      FROM actor_active_location aal
      LEFT JOIN addresses a ON a.address_id = aal.address_id
      WHERE aal.tenant_id = $1 AND aal.actor_id = $2 AND aal.is_active = true
      LIMIT 1
      `,
      [tenantId, actorId]
    );
    return row ? toHydratedModel(row) : null;
  }

  /**
   * Define localização ativa do actor (set).
   *
   * Idempotência: desativa localização anterior (UPDATE is_active=false) ANTES de INSERT
   * — preserva histórico append-only. UNIQUE parcial garante apenas 1 ativa por actor.
   *
   * CHECK garante address_id OR (lat AND lng) — caller deve respeitar.
   */
  async setActive(
    tenantId: string,
    actorId: string,
    input: SetActorActiveLocationInput
  ): Promise<ActorActiveLocation> {
    if (!input.addressId && (input.lat === null || input.lat === undefined ||
        input.lng === null || input.lng === undefined)) {
      throw new Error('actor_active_location: address_id OR (lat AND lng) required');
    }

    // 1. Desativar localização anterior (se existir)
    await runQueryWithTenant(
      tenantId,
      `
      UPDATE actor_active_location
      SET is_active = false
      WHERE tenant_id = $1 AND actor_id = $2 AND is_active = true
      `,
      [tenantId, actorId]
    );

    // 2. Inserir nova localização ativa
    const row = await runQueryWithTenant<ActorActiveLocationRow>(
      tenantId,
      `
      INSERT INTO actor_active_location (
        tenant_id, actor_id, address_id, lat, lng,
        source, scope_level, expires_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      RETURNING id, tenant_id, actor_id, address_id, lat::text AS lat, lng::text AS lng,
                source, scope_level, activated_at, expires_at, is_active, metadata, created_at
      `,
      [
        tenantId,
        actorId,
        input.addressId ?? null,
        input.lat ?? null,
        input.lng ?? null,
        input.source,
        input.scopeLevel ?? null,
        input.expiresAt ?? null,
        JSON.stringify(input.metadata ?? {}),
      ]
    );
    if (!row) throw new Error('actor_active_location: INSERT did not return row');
    return toModel(row);
  }

  /**
   * Desativa localização ativa do actor (clear).
   * Não DELETA — apenas seta is_active=false (preserva histórico).
   */
  async clearActive(tenantId: string, actorId: string): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `
      UPDATE actor_active_location
      SET is_active = false
      WHERE tenant_id = $1 AND actor_id = $2 AND is_active = true
      `,
      [tenantId, actorId]
    );
  }
}

export const actorActiveLocationRepository = new ActorActiveLocationRepository();
