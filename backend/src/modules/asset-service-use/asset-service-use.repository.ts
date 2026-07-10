// backend/src/modules/asset-service-use/asset-service-use.repository.ts
// F-ASSET-MULTI-OFFER-FOUNDATION Fatia 4B — leitor/escritor do vínculo de uso operacional. Identidade do item
// é actor_assets; a ATIVAÇÃO é actor_asset_modes('service_use'); a JUNÇÃO N (asset×service_concept×operador)
// vive em actor_asset_service_usages. NÃO toca sale_terms/rental_terms/products/service_offerings/Bank.
// RLS filtra tenant (derivada via actor_assets, sem tenant_id denormalizado nesta tabela).

import { runQueryWithTenant, runQueriesWithTenant, getClientWithTenant } from '@core/database/pool';
import type { AssetServiceUsage, CreateAssetServiceUsageInput, AssetServiceUseStatus } from './asset-service-use.types';

const AASU_SELECT = `u.id, a.id AS asset_id, a.owner_actor_id, a.concept_id AS asset_concept_id, a.label AS asset_label,
  u.service_concept_id, u.operator_actor_id, u.arrangement_type, u.status, u.is_active, u.created_at, u.updated_at`;

function toDomain(row: any): AssetServiceUsage {
  return {
    id: row.id,
    assetId: row.asset_id,
    ownerActorId: row.owner_actor_id,
    assetConceptId: row.asset_concept_id,
    assetLabel: row.asset_label,
    serviceConceptId: row.service_concept_id,
    operatorActorId: row.operator_actor_id,
    arrangementType: row.arrangement_type,
    status: row.status as AssetServiceUseStatus,
    isActive: !!row.is_active,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

class AssetServiceUseRepository {
  /** Dono + concept do asset EXISTENTE (autoridade + derivação do operador dono-only na Fatia 4B). RLS filtra tenant. */
  async findAssetOwnerAndConcept(tenantId: string, assetId: string): Promise<{ ownerActorId: string; conceptId: string } | null> {
    const row = await runQueryWithTenant<{ owner_actor_id: string; concept_id: string }>(
      tenantId,
      `SELECT owner_actor_id, concept_id FROM actor_assets WHERE id = $1::uuid LIMIT 1`,
      [assetId]);
    return row ? { ownerActorId: row.owner_actor_id, conceptId: row.concept_id } : null;
  }

  /** company_id DERIVADO server-side do actor (mesmo padrão de service-offering.service.ts) — PJ se presente. */
  async findCompanyIdForActor(tenantId: string, actorId: string): Promise<string | null> {
    const row = await runQueryWithTenant<{ company_id: string | null }>(
      tenantId,
      `SELECT company_id FROM actors WHERE id = $1::uuid LIMIT 1`,
      [actorId]);
    return row?.company_id ?? null;
  }

  /** D-B/invariante 8-9: gate de aplicabilidade (concept ofertável como serviço). Espelho do enforcement
   *  material da FK composta (fk_aasu_service_concept_is_offerable) — validado cedo p/ erro claro. */
  async serviceConceptIsOfferable(tenantId: string, serviceConceptId: string): Promise<boolean> {
    const row = await runQueryWithTenant<{ ok: boolean }>(
      tenantId,
      `SELECT EXISTS (SELECT 1 FROM concept_offer_kinds WHERE concept_id = $1::uuid AND offer_kind = 'service') AS ok`,
      [serviceConceptId]);
    return !!row?.ok;
  }

  /**
   * Ativa/atualiza o vínculo de uso operacional SOBRE UM ASSET JÁ EXISTENTE (Fatia 4B NÃO cadastra item
   * novo). Atômico: 1) upsert actor_asset_modes='service_use' 2) upsert actor_asset_service_usages
   * (ON CONFLICT asset_id,service_concept_id,operator_actor_id — reativar é UPDATE, não linha duplicada).
   * NÃO cria actor_asset, NÃO toca sale_terms/rental_terms/modo sale/modo rental.
   */
  async activate(tenantId: string, assetId: string, operatorActorId: string, input: CreateAssetServiceUsageInput): Promise<AssetServiceUsage> {
    const client = await getClientWithTenant(tenantId);
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO actor_asset_modes (asset_id, activation_mode, enabled) VALUES ($1::uuid, 'service_use', true)
           ON CONFLICT (asset_id, activation_mode) DO UPDATE SET enabled = true, updated_at = now()`,
        [assetId]);
      const upsert = await client.query(
        `INSERT INTO actor_asset_service_usages (asset_id, service_concept_id, operator_actor_id, arrangement_type, status, is_active)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4, 'active', true)
           ON CONFLICT (asset_id, service_concept_id, operator_actor_id) DO UPDATE SET
             arrangement_type = EXCLUDED.arrangement_type, status = 'active', is_active = true, updated_at = now()
         RETURNING id`,
        [assetId, input.serviceConceptId, operatorActorId, input.arrangementType]);
      const usageId = upsert.rows[0].id as string;
      const read = await client.query(
        `SELECT ${AASU_SELECT} FROM actor_assets a JOIN actor_asset_service_usages u ON u.asset_id = a.id WHERE u.id = $1::uuid`,
        [usageId]);
      await client.query('COMMIT');
      return toDomain(read.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findById(tenantId: string, id: string): Promise<AssetServiceUsage | null> {
    const row = await runQueryWithTenant<any>(
      tenantId,
      `SELECT ${AASU_SELECT}
         FROM actor_assets a
         JOIN actor_asset_service_usages u ON u.asset_id = a.id
        WHERE u.id = $1::uuid LIMIT 1`,
      [id]);
    return row ? toDomain(row) : null;
  }

  /** "Meus usos operacionais" — vínculos do dono-operador (gestão). RLS filtra tenant. */
  async listByOwner(tenantId: string, ownerActorId: string): Promise<AssetServiceUsage[]> {
    const rows = await runQueriesWithTenant<any>(
      tenantId,
      `SELECT ${AASU_SELECT}
         FROM actor_assets a
         JOIN actor_asset_service_usages u ON u.asset_id = a.id
        WHERE a.owner_actor_id = $1::uuid
        ORDER BY u.created_at DESC`,
      [ownerActorId]);
    return rows.map(toDomain);
  }

  async updateStatus(tenantId: string, id: string, status: AssetServiceUseStatus): Promise<AssetServiceUsage | null> {
    const upd = await runQueryWithTenant<{ id: string }>(
      tenantId,
      `UPDATE actor_asset_service_usages SET status = $2, is_active = ($2 = 'active'), updated_at = now()
        WHERE id = $1::uuid RETURNING id`,
      [id, status]);
    if (!upd) return null;
    return this.findById(tenantId, id);
  }
}

export const assetServiceUseRepository = new AssetServiceUseRepository();
