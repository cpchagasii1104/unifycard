// canonical-variant.service.ts
// DECISION-0117 A — variante canônica: configuração material exata do item
// vendável. Eixos discriminadores tipados PARTICIPAM do fingerprint (não vivem
// só em JSON livre). GTIN distinto ⇒ variante distinta (uidx global).
// Sem preço; sem estoque (oferta/actor). Dedup concorrente fail-closed via
// UNIQUE + retry de leitura. Trilha em canonical_catalog_events (append-only).

import type { PoolClient } from 'pg';
import { pool } from '../../database/pool';
import { canonicalUnitsService } from './canonical-units.service';
import { computeVariantFingerprintV1 } from './catalog-identity';

export class CanonicalVariantError extends Error {
  constructor(public readonly statusCode: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'CanonicalVariantError';
  }
}

export interface CanonicalVariant {
  id: string;
  canonicalProductId: string;
  variantName: string;
  gtin: string | null;
  netContentValue: number | null;
  netContentUnit: string | null;
  packageType: string | null;
  isReturnable: boolean | null;
  discriminatorAttributes: Record<string, unknown>;
  fingerprintV1: string;
  status: string;
  duplicateOfVariantId: string | null;
  createdByActorId: string | null;
}

interface VariantRow {
  id: string;
  canonical_product_id: string;
  variant_name: string;
  gtin: string | null;
  net_content_value: string | null;
  net_content_unit: string | null;
  package_type: string | null;
  is_returnable: boolean | null;
  discriminator_attributes: unknown;
  fingerprint_v1: string;
  status: string;
  duplicate_of_variant_id: string | null;
  created_by_actor_id: string | null;
}

const CV_SELECT =
  'id, canonical_product_id, variant_name, gtin, net_content_value, net_content_unit, ' +
  'package_type, is_returnable, discriminator_attributes, fingerprint_v1, status, ' +
  'duplicate_of_variant_id, created_by_actor_id';

function toVariant(row: VariantRow): CanonicalVariant {
  return {
    id: row.id,
    canonicalProductId: row.canonical_product_id,
    variantName: row.variant_name,
    gtin: row.gtin,
    netContentValue: row.net_content_value == null ? null : Number(row.net_content_value),
    netContentUnit: row.net_content_unit,
    packageType: row.package_type,
    isReturnable: row.is_returnable,
    discriminatorAttributes:
      row.discriminator_attributes && typeof row.discriminator_attributes === 'object' && !Array.isArray(row.discriminator_attributes)
        ? (row.discriminator_attributes as Record<string, unknown>)
        : {},
    fingerprintV1: row.fingerprint_v1,
    status: row.status,
    duplicateOfVariantId: row.duplicate_of_variant_id,
    createdByActorId: row.created_by_actor_id,
  };
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}

/**
 * F-CATALOG-RLS-SCOPED-ISOLATION: canonical_catalog_events tem RLS (leitura tenant-scoped +
 * admin-bypass; escrita permanece permissiva — WITH CHECK(true), ver migration 20260702130000).
 * `client` opcional: se o caller já tem um client com contexto setado (tenant ou admin — ex.
 * canonical-service.service.ts), passa aqui para reaproveitar a MESMA transação/sessão. Callers
 * de produto (canonical-variant.service.ts, OUT of scope desta DT) continuam sem passar client —
 * caem no pool.query cru de sempre; a leitura é o que a DT protege, a escrita permanece aberta.
 */
async function insertCatalogEvent(
  input: {
    entityType: 'canonical_product' | 'canonical_variant' | 'canonical_service' | 'media_asset';
    entityId: string;
    eventType: string;
    payload?: Record<string, unknown>;
    actorId?: string | null;
    tenantId?: string | null;
  },
  client?: PoolClient
): Promise<void> {
  const runner = client ?? pool;
  await runner.query(
    `INSERT INTO canonical_catalog_events (entity_type, entity_id, event_type, payload, actor_id, tenant_id)
     VALUES ($1, $2::uuid, $3, $4::jsonb, $5, $6)`,
    [
      input.entityType,
      input.entityId,
      input.eventType,
      JSON.stringify(input.payload ?? {}),
      input.actorId ?? null,
      input.tenantId ?? null,
    ]
  );
}

export { insertCatalogEvent };

export interface CreateCanonicalVariantInput {
  tenantId: string | null;
  canonicalProductId: string;
  variantName: string;
  gtin?: string | null;
  netContentValue?: number | null;
  netContentUnit?: string | null;
  packageType?: string | null;
  isReturnable?: boolean | null;
  discriminatorAttributes?: Record<string, unknown> | null;
  createdByActorId?: string | null;
}

export const canonicalVariantService = {
  async findById(variantId: string): Promise<CanonicalVariant | null> {
    const r = await pool.query<VariantRow>(
      `SELECT ${CV_SELECT} FROM canonical_variants WHERE id = $1::uuid LIMIT 1`,
      [variantId]
    );
    return r.rows[0] ? toVariant(r.rows[0]) : null;
  },

  async findByGtin(gtin: string): Promise<CanonicalVariant | null> {
    const g = String(gtin ?? '').trim();
    if (!g) return null;
    const r = await pool.query<VariantRow>(
      `SELECT ${CV_SELECT} FROM canonical_variants WHERE gtin = $1 LIMIT 1`,
      [g]
    );
    return r.rows[0] ? toVariant(r.rows[0]) : null;
  },

  async listByProduct(canonicalProductId: string, opts?: { includeRetired?: boolean }): Promise<CanonicalVariant[]> {
    const r = await pool.query<VariantRow>(
      `SELECT ${CV_SELECT} FROM canonical_variants
        WHERE canonical_product_id = $1::uuid
          ${opts?.includeRetired ? '' : `AND status <> 'retired'`}
        ORDER BY created_at ASC`,
      [canonicalProductId]
    );
    return r.rows.map(toVariant);
  },

  /**
   * Resolve redirect de merge (DECISION-0117 G): segue duplicate_of até o
   * vencedor (máx. 5 saltos, loop-safe). Referências antigas continuam válidas.
   */
  async resolveRedirect(variantId: string): Promise<CanonicalVariant | null> {
    let current = await this.findById(variantId);
    const seen = new Set<string>();
    let hops = 0;
    while (current?.duplicateOfVariantId && hops < 5 && !seen.has(current.id)) {
      seen.add(current.id);
      const next = await this.findById(current.duplicateOfVariantId);
      if (!next) break;
      current = next;
      hops += 1;
    }
    return current;
  },

  /**
   * Cria variante GOVERNADA (única porta de escrita). Dedup fail-closed:
   * 1) GTIN existente ⇒ retorna a variante existente (sem duplicar);
   * 2) fingerprint igual no mesmo produto ⇒ retorna existente;
   * 3) corrida concorrente ⇒ UNIQUE 23505 ⇒ releitura idempotente.
   * Retornável ≠ descartável e 1L ≠ 2L por construção (eixos no fingerprint).
   */
  async createGoverned(input: CreateCanonicalVariantInput): Promise<{ variant: CanonicalVariant; created: boolean }> {
    const name = String(input.variantName ?? '').trim();
    if (!name) {
      throw new CanonicalVariantError(400, 'VARIANT_NAME_REQUIRED', 'variantName é obrigatório.');
    }
    const product = await pool.query<{ id: string; tenant_id: string | null; scope: string }>(
      `SELECT id, tenant_id, scope FROM canonical_products WHERE id = $1::uuid LIMIT 1`,
      [input.canonicalProductId]
    );
    if (product.rowCount === 0) {
      throw new CanonicalVariantError(404, 'CANONICAL_PRODUCT_NOT_FOUND', 'Produto canônico inexistente.');
    }
    if (input.netContentUnit != null && String(input.netContentUnit).trim() !== '') {
      await canonicalUnitsService.assertUnitKnown(String(input.netContentUnit));
    }

    const gtin = input.gtin == null || String(input.gtin).trim() === '' ? null : String(input.gtin).trim();
    if (gtin) {
      const byGtin = await this.findByGtin(gtin);
      if (byGtin) return { variant: byGtin, created: false };
    }

    const fingerprint = computeVariantFingerprintV1({
      gtin,
      variantName: name,
      netContentValue: input.netContentValue ?? null,
      netContentUnit: input.netContentUnit ?? null,
      packageType: input.packageType ?? null,
      isReturnable: input.isReturnable ?? null,
      discriminatorAttributes: input.discriminatorAttributes ?? null,
    });

    const byFp = await pool.query<VariantRow>(
      `SELECT ${CV_SELECT} FROM canonical_variants
        WHERE canonical_product_id = $1::uuid AND fingerprint_v1 = $2 LIMIT 1`,
      [input.canonicalProductId, fingerprint]
    );
    if (byFp.rows[0]) return { variant: toVariant(byFp.rows[0]), created: false };

    try {
      const ins = await pool.query<VariantRow>(
        `INSERT INTO canonical_variants (
           canonical_product_id, variant_name, gtin, net_content_value, net_content_unit,
           package_type, is_returnable, discriminator_attributes, fingerprint_v1,
           status, created_by_actor_id
         ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, 'active', $10)
         RETURNING ${CV_SELECT}`,
        [
          input.canonicalProductId,
          name,
          gtin,
          input.netContentValue ?? null,
          input.netContentUnit ?? null,
          input.packageType ?? null,
          input.isReturnable ?? null,
          JSON.stringify(input.discriminatorAttributes ?? {}),
          fingerprint,
          input.createdByActorId ?? null,
        ]
      );
      const variant = toVariant(ins.rows[0]);
      await insertCatalogEvent({
        entityType: 'canonical_variant',
        entityId: variant.id,
        eventType: 'variant_created',
        payload: { canonicalProductId: variant.canonicalProductId, gtin, fingerprint },
        actorId: input.createdByActorId ?? null,
        tenantId: input.tenantId,
      });
      return { variant, created: true };
    } catch (err) {
      if (isUniqueViolation(err)) {
        if (gtin) {
          const winner = await this.findByGtin(gtin);
          if (winner) return { variant: winner, created: false };
        }
        const retry = await pool.query<VariantRow>(
          `SELECT ${CV_SELECT} FROM canonical_variants
            WHERE canonical_product_id = $1::uuid AND fingerprint_v1 = $2 LIMIT 1`,
          [input.canonicalProductId, fingerprint]
        );
        if (retry.rows[0]) return { variant: toVariant(retry.rows[0]), created: false };
      }
      throw err;
    }
  },

  /**
   * Merge curatorial de variantes (DECISION-0117 G): duplicate → winner por
   * redirect; append-only; não destrói ofertas; idempotente.
   */
  async mergeInto(input: { duplicateVariantId: string; winnerVariantId: string; actorId: string; tenantId?: string | null }): Promise<void> {
    if (input.duplicateVariantId === input.winnerVariantId) {
      throw new CanonicalVariantError(400, 'MERGE_SELF', 'Variante não pode ser merge de si mesma.');
    }
    const dup = await this.findById(input.duplicateVariantId);
    const winner = await this.findById(input.winnerVariantId);
    if (!dup || !winner) {
      throw new CanonicalVariantError(404, 'VARIANT_NOT_FOUND', 'Variante inexistente no merge.');
    }
    if (dup.duplicateOfVariantId === winner.id) return; // idempotente
    if (winner.duplicateOfVariantId) {
      throw new CanonicalVariantError(409, 'MERGE_WINNER_IS_DUPLICATE', 'O vencedor do merge já é redirect de outra variante.');
    }
    await pool.query(
      `UPDATE canonical_variants
          SET duplicate_of_variant_id = $2::uuid, status = 'retired', updated_at = NOW()
        WHERE id = $1::uuid`,
      [dup.id, winner.id]
    );
    await insertCatalogEvent({
      entityType: 'canonical_variant',
      entityId: dup.id,
      eventType: 'variant_merged_into',
      payload: { winnerVariantId: winner.id },
      actorId: input.actorId,
      tenantId: input.tenantId ?? null,
    });
  },
};
