// backend/src/modules/asset-sale/asset-sale.repository.ts
// F-ASSET-MULTI-OFFER-FOUNDATION Fatia 3 — leitor/escritor da VENDA asset-first. A identidade do item é
// actor_assets; a ativação é actor_asset_modes('sale'); os TERMOS vivem em actor_asset_sale_terms (1:1).
// NÃO toca products/product_offers/inventory/Bank/orders/payment_intents. RLS filtra tenant.

import { runQueryWithTenant, runQueriesWithTenant, getClientWithTenant } from '@core/database/pool';
import type { AssetSaleOffer, CreateAssetSaleInput, AssetSaleStatus, AssetSaleVisibility } from './asset-sale.types';

// SELECT canônico da leitura convergida (asset + sale_terms). RLS de ambas filtra por tenant.
const AAST_SELECT = `a.id AS asset_id, a.tenant_id, a.owner_actor_id, a.concept_id, a.label, a.condition,
  s.price_cents, s.status, s.is_active, s.visibility, s.audience_relationship_types, s.negotiable, s.sale_notes,
  a.created_at, s.updated_at`;

function toDomain(row: any): AssetSaleOffer {
  return {
    assetId: row.asset_id,
    tenantId: row.tenant_id,
    ownerActorId: row.owner_actor_id,
    conceptId: row.concept_id,
    label: row.label,
    condition: row.condition ?? null,
    priceCents: row.price_cents !== null && row.price_cents !== undefined ? Number(row.price_cents) : null,
    status: row.status as AssetSaleStatus,
    isActive: row.is_active,
    visibility: row.visibility as AssetSaleVisibility,
    audienceRelationshipTypes: row.audience_relationship_types ?? null,
    negotiable: !!row.negotiable,
    saleNotes: row.sale_notes ?? null,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

class AssetSaleRepository {
  /** Gate de convergência: concept é asset-elegível (bem durável)? Governança concept_asset_eligibilities
   *  (GLOBAL, mesma da locação). NÃO usa category. */
  async conceptIsAssetEligible(tenantId: string, conceptId: string): Promise<boolean> {
    const row = await runQueryWithTenant<{ ok: boolean }>(
      tenantId,
      `SELECT EXISTS (SELECT 1 FROM concept_asset_eligibilities WHERE concept_id = $1::uuid) AS ok`,
      [conceptId]);
    return !!row?.ok;
  }

  /** Criar VENDA = ATO SOBRE O ITEM REAL, atômico sobre tabelas RLS-seguras (client dedicado com GUC de
   *  tenant + BEGIN/COMMIT). 1) actor_assets (identidade) · 2) actor_asset_modes='sale' · 3) actor_asset_sale_terms
   *  (termos). Nenhum product/product_offers criado. Elegibilidade validada no SERVICE antes daqui. */
  async create(tenantId: string, ownerActorId: string, input: CreateAssetSaleInput): Promise<AssetSaleOffer> {
    const client = await getClientWithTenant(tenantId);
    try {
      await client.query('BEGIN');
      const assetRes = await client.query(
        `INSERT INTO actor_assets (tenant_id, owner_actor_id, concept_id, label, status, condition)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4, 'active', $5) RETURNING id`,
        [tenantId, ownerActorId, input.conceptId, input.label, input.condition ?? null]
      );
      const assetId = assetRes.rows[0].id as string;
      await client.query(
        `INSERT INTO actor_asset_modes (asset_id, activation_mode, enabled) VALUES ($1::uuid, 'sale', true)`,
        [assetId]
      );
      await client.query(
        `INSERT INTO actor_asset_sale_terms
           (asset_id, price_cents, status, visibility, audience_relationship_types, negotiable, sale_notes)
         VALUES ($1::uuid, $2::bigint, 'active', $3, $4::text[], $5, $6)`,
        [assetId, input.priceCents ?? null, input.visibility ?? 'public',
         input.audienceRelationshipTypes ?? null, input.negotiable ?? false, input.saleNotes ?? null]
      );
      const read = await client.query(
        `SELECT ${AAST_SELECT} FROM actor_assets a JOIN actor_asset_sale_terms s ON s.asset_id = a.id WHERE a.id = $1::uuid`,
        [assetId]
      );
      await client.query('COMMIT');
      return toDomain(read.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findById(tenantId: string, assetId: string): Promise<AssetSaleOffer | null> {
    const row = await runQueryWithTenant<any>(
      tenantId,
      `SELECT ${AAST_SELECT}
         FROM actor_assets a
         JOIN actor_asset_sale_terms s ON s.asset_id = a.id
         JOIN actor_asset_modes m ON m.asset_id = a.id AND m.activation_mode = 'sale'
        WHERE a.id = $1::uuid LIMIT 1`,
      [assetId]);
    return row ? toDomain(row) : null;
  }

  /** "Minhas vendas" — ofertas de venda ativas/pausadas do dono (gestão). RLS filtra tenant. */
  async listByOwner(tenantId: string, ownerActorId: string): Promise<AssetSaleOffer[]> {
    const rows = await runQueriesWithTenant<any>(
      tenantId,
      `SELECT ${AAST_SELECT}
         FROM actor_assets a
         JOIN actor_asset_sale_terms s ON s.asset_id = a.id
         JOIN actor_asset_modes m ON m.asset_id = a.id AND m.activation_mode = 'sale'
        WHERE a.owner_actor_id = $1::uuid
        ORDER BY a.created_at DESC`,
      [ownerActorId]);
    return rows.map(toDomain);
  }

  /** Muda status da OFERTA de venda (active/paused). Termos vivem em actor_asset_sale_terms (RLS via asset). */
  async updateStatus(tenantId: string, assetId: string, status: AssetSaleStatus): Promise<AssetSaleOffer | null> {
    const upd = await runQueryWithTenant<{ asset_id: string }>(
      tenantId,
      `UPDATE actor_asset_sale_terms SET status = $2, is_active = ($2 = 'active'), updated_at = now()
        WHERE asset_id = $1::uuid RETURNING asset_id`,
      [assetId, status]);
    if (!upd) return null;
    return this.findById(tenantId, assetId);
  }

  /** Edita a OFERTA de venda (não a identidade). Só sobrescreve o que veio. condition (item) é atualizada à parte. */
  async updateOffer(tenantId: string, assetId: string, input: {
    priceCents?: number | null; visibility?: string; audienceRelationshipTypes?: string[] | null;
    negotiable?: boolean; saleNotes?: string | null; conditionTouched?: boolean; condition?: string | null;
  }): Promise<void> {
    // D1: condição é atributo do ITEM real (actor_assets.condition) — não vive nos termos de venda.
    if (input.conditionTouched === true) {
      await runQueriesWithTenant(tenantId,
        `UPDATE actor_assets SET condition = $2, updated_at = now() WHERE id = $1::uuid`,
        [assetId, input.condition ?? null]);
    }
    await runQueriesWithTenant(tenantId,
      `UPDATE actor_asset_sale_terms SET
         price_cents = CASE WHEN $2::boolean THEN $3::bigint ELSE price_cents END,
         visibility = COALESCE($4, visibility),
         audience_relationship_types = CASE WHEN $5::boolean THEN $6::text[] ELSE audience_relationship_types END,
         negotiable = COALESCE($7::boolean, negotiable),
         sale_notes = CASE WHEN $8::boolean THEN $9 ELSE sale_notes END,
         updated_at = now()
       WHERE asset_id = $1::uuid`,
      [
        assetId,
        input.priceCents !== undefined, input.priceCents ?? null,
        input.visibility ?? null,
        input.audienceRelationshipTypes !== undefined, input.audienceRelationshipTypes ?? null,
        input.negotiable ?? null,
        input.saleNotes !== undefined, input.saleNotes ?? null,
      ]);
  }
}

export const assetSaleRepository = new AssetSaleRepository();
