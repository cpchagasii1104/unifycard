// canonical-product.repository.ts
// Persistência de `canonical_products` (catálogo industrial por tenant).
// SSOT semântico: `concepts` via `concept_id` — §5.3 (07_NOMENCLATURA_CANONICA.md).
//
// fingerprint_v1: DO NOT change persistence or lookup rules without updating
// docs/01_normative/07_NOMENCLATURA_CANONICA.md §4.76 and SQL migrations (single source: PostgreSQL trigger + functions).

import { pool, runQueryWithTenant } from '../../database/pool';
import {
  sqlCanonicalIdMatchesTenantContext,
  sqlOrderScopedCanonicalFirst,
} from './canonical-product-readiness';
import { recordConceptResolutionQueueEnqueueAudit } from './canonical-concept-resolution-audit';
import { insertCanonicalProductEvent } from './canonical-product-events.repository';
import type { ConceptResolutionStatus } from './canonical-concept.types';
import type { CanonicalProductDbRow } from './canonical-product-db.types';

/** Linha persistida no domínio backend (camelCase — §5.2). */
export interface CanonicalProductPersistRow {
  id: string;
  /** NULL para linha global (`scope = 'global'`). */
  tenantId: string | null;
  gtin: string | null;
  name: string;
  brand: string | null;
  images: unknown;
  attributes: unknown;
  categoryId: string | null;
  type: string;
  fingerprintV1: string | null;
  conceptId: string | null;
  conceptResolutionStatus: ConceptResolutionStatus;
  version: number;
  createdByActorId: string | null;
}

function toPersistRow(row: CanonicalProductDbRow): CanonicalProductPersistRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    gtin: row.gtin,
    name: row.name,
    brand: row.brand,
    images: row.images,
    attributes: row.attributes,
    categoryId: row.category_id,
    type: row.type,
    fingerprintV1: row.fingerprint_v1 ?? null,
    conceptId: row.concept_id ?? null,
    conceptResolutionStatus: (row.concept_resolution_status as ConceptResolutionStatus) ?? 'unresolved',
    version: row.version ?? 1,
    createdByActorId: row.created_by_actor_id ?? null,
  };
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}

/** Aligns with DB trigger + §4.76: btrim; empty -> null. */
function normalizeGtinColumn(value: string | null | undefined): string | null {
  if (value == null) return null;
  const t = String(value).trim();
  return t === '' ? null : t;
}

const CP_SELECT =
  'id, tenant_id, gtin, name, brand, images, attributes, category_id, type, ' +
  'fingerprint_v1, concept_id, concept_resolution_status, version, created_by_actor_id';

export const canonicalProductRepository = {
  async findByTenantAndGtin(
    tenantId: string,
    gtin: string
  ): Promise<CanonicalProductPersistRow | null> {
    const g = normalizeGtinColumn(gtin);
    if (!g) return null;
    const vis = sqlCanonicalIdMatchesTenantContext('canonical_products', '$1::uuid');
    const ord = sqlOrderScopedCanonicalFirst('canonical_products');
    const row = await runQueryWithTenant<CanonicalProductDbRow>(
      tenantId,
      `
      SELECT ${CP_SELECT}
      FROM canonical_products
      WHERE ${vis}
        AND gtin = $2 AND type = 'INDUSTRIAL'
      ORDER BY ${ord}, created_at ASC
      LIMIT 1
      `,
      [tenantId, g]
    );
    return row ? toPersistRow(row) : null;
  },

  async findByTenantAndFingerprintV1(
    tenantId: string,
    fingerprintV1: string
  ): Promise<CanonicalProductPersistRow | null> {
    const vis = sqlCanonicalIdMatchesTenantContext('canonical_products', '$1::uuid');
    const ord = sqlOrderScopedCanonicalFirst('canonical_products');
    const row = await runQueryWithTenant<CanonicalProductDbRow>(
      tenantId,
      `
      SELECT ${CP_SELECT}
      FROM canonical_products
      WHERE ${vis}
        AND fingerprint_v1 = $2 AND type = 'INDUSTRIAL'
      ORDER BY ${ord}, created_at ASC
      LIMIT 1
      `,
      [tenantId, fingerprintV1]
    );
    return row ? toPersistRow(row) : null;
  },

  /**
   * Resolve linha pelo mesmo algoritmo do INSERT (pós-23505 sem recalcular fingerprint em TS).
   */
  async findIndustrialByFingerprintInputs(
    tenantId: string,
    gtin: string | null,
    name: string,
    brand: string | null,
    attrsJson: string
  ): Promise<CanonicalProductPersistRow | null> {
    const g = normalizeGtinColumn(gtin);
    const vis = sqlCanonicalIdMatchesTenantContext('canonical_products', '$1::uuid');
    const ord = sqlOrderScopedCanonicalFirst('canonical_products');
    const row = await runQueryWithTenant<CanonicalProductDbRow>(
      tenantId,
      `
      SELECT ${CP_SELECT}
      FROM canonical_products
      WHERE ${vis}
        AND type = 'INDUSTRIAL'
        AND fingerprint_v1 = canonical_product_fingerprint_v1(
          $2,
          $3,
          $4,
          COALESCE($5::jsonb, '{}'::jsonb)
        )
      ORDER BY ${ord}, created_at ASC
      LIMIT 1
      `,
      [tenantId, g, name, brand, attrsJson]
    );
    return row ? toPersistRow(row) : null;
  },

  /**
   * Match forte: mesmo tenant, nome e marca normalizados (TRIM + LOWER), mesma categoria.
   */
  async findByTenantNameBrandCategory(
    tenantId: string,
    name: string,
    brand: string | null,
    categoryId: string
  ): Promise<CanonicalProductPersistRow | null> {
    const vis = sqlCanonicalIdMatchesTenantContext('canonical_products', '$1::uuid');
    const ord = sqlOrderScopedCanonicalFirst('canonical_products');
    const row = await runQueryWithTenant<CanonicalProductDbRow>(
      tenantId,
      `
      SELECT ${CP_SELECT}
      FROM canonical_products
      WHERE ${vis}
        AND type = 'INDUSTRIAL'
        AND category_id = $2
        AND LOWER(TRIM(name)) = LOWER(TRIM($3::text))
        AND COALESCE(LOWER(TRIM(brand)), '') = COALESCE(LOWER(TRIM($4::text)), '')
      ORDER BY ${ord}, created_at ASC
      LIMIT 1
      `,
      [tenantId, categoryId, name, brand ?? '']
    );
    return row ? toPersistRow(row) : null;
  },

  /**
   * INSERT INDUSTRIAL + fila `pending` na mesma transação (obrigatório para trigger DEFERRABLE de governança).
   */
  async insertIndustrialWithPendingConceptQueue(params: {
    tenantId: string;
    gtin: string | null;
    name: string;
    brand: string | null;
    categoryId: string;
    images?: unknown;
    attributes?: unknown;
  }): Promise<CanonicalProductPersistRow> {
    const imagesJson = JSON.stringify(
      Array.isArray(params.images) ? params.images : []
    );
    const attrsObj =
      params.attributes && typeof params.attributes === 'object' && !Array.isArray(params.attributes)
        ? params.attributes
        : {};
    const attrsJson = JSON.stringify(attrsObj);
    const gtinNorm = normalizeGtinColumn(params.gtin);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // 🔴 F-GUC-CROSS-CONTEXT-RESET-ON-REUSE-FIX (2026-07-02, achado A1 da re-auditoria
      // adversarial): is_local=TRUE aqui (não false) — dentro de BEGIN...COMMIT explícito, o GUC
      // reverte sozinho no COMMIT/ROLLBACK e nunca sobrevive ao client.release(); is_local=false
      // ficaria PRESO na conexão pooled além desta transação, vazando pro próximo uso da mesma
      // conexão física (mesma classe do achado A1 em pool.ts).
      await client.query("SELECT set_config('app.current_tenant', $1, true)", [params.tenantId]);

      const ins = await client.query<CanonicalProductDbRow>(
        `
        INSERT INTO canonical_products (
          tenant_id, gtin, name, brand, images, attributes, category_id, type,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, 'INDUSTRIAL', NOW(), NOW())
        RETURNING ${CP_SELECT}
        `,
        [
          params.tenantId,
          gtinNorm,
          params.name,
          params.brand,
          imagesJson,
          attrsJson,
          params.categoryId,
        ]
      );
      const row = ins.rows[0];
      if (!row) {
        throw new Error('INSERT canonical_products não retornou linha');
      }

      await client.query(
        `
        INSERT INTO canonical_concept_resolution_queue (
          canonical_product_id,
          status,
          created_at
        )
        SELECT $1::uuid, 'pending', NOW()
        WHERE NOT EXISTS (
          SELECT 1 FROM canonical_concept_resolution_queue q
          WHERE q.canonical_product_id = $1::uuid AND q.status = 'pending'
        )
        `,
        [row.id]
      );

      await client.query('COMMIT');
      void recordConceptResolutionQueueEnqueueAudit(params.tenantId, row.id).catch(() => {});
      return toPersistRow(row);
    } catch (err) {
      await client.query('ROLLBACK');
      if (isUniqueViolation(err)) {
        if (isUniqueViolation(err) && gtinNorm) {
          void (async () => {
            try {
              const conflicting = await this.findByTenantAndGtin(params.tenantId, gtinNorm);
              if (conflicting?.id) {
                await insertCanonicalProductEvent({
                  canonicalProductId: conflicting.id,
                  tenantId: params.tenantId,
                  eventType: 'gtin_collision_blocked',
                  payload: {
                    gtin: gtinNorm,
                    scope: 'scoped',
                    reason: 'unique_violation',
                    conflicting_id: conflicting.id,
                  },
                });
              }
            } catch {
              // Silencioso — evento de colisão não pode bloquear o retry.
            }
          })();
        }
        const byFp = await this.findIndustrialByFingerprintInputs(
          params.tenantId,
          gtinNorm,
          params.name,
          params.brand,
          attrsJson
        );
        if (byFp) {
          return byFp;
        }
        if (gtinNorm) {
          const existing = await this.findByTenantAndGtin(params.tenantId, gtinNorm);
          if (existing) {
            return existing;
          }
        }
      }
      throw err;
    } finally {
      client.release();
    }
  },

  async insertIndustrial(params: {
    tenantId: string;
    gtin: string | null;
    name: string;
    brand: string | null;
    categoryId: string;
    images?: unknown;
    attributes?: unknown;
  }): Promise<CanonicalProductPersistRow> {
    const imagesJson = JSON.stringify(
      Array.isArray(params.images) ? params.images : []
    );
    const attrsObj =
      params.attributes && typeof params.attributes === 'object' && !Array.isArray(params.attributes)
        ? params.attributes
        : {};
    const attrsJson = JSON.stringify(attrsObj);
    const gtinNorm = normalizeGtinColumn(params.gtin);

    try {
      const row = await runQueryWithTenant<CanonicalProductDbRow>(
        params.tenantId,
        `
        INSERT INTO canonical_products (
          tenant_id, gtin, name, brand, images, attributes, category_id, type,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, 'INDUSTRIAL', NOW(), NOW())
        RETURNING ${CP_SELECT}
        `,
        [
          params.tenantId,
          gtinNorm,
          params.name,
          params.brand,
          imagesJson,
          attrsJson,
          params.categoryId,
        ]
      );
      if (!row) {
        throw new Error('INSERT canonical_products não retornou linha');
      }
      return toPersistRow(row);
    } catch (err) {
      if (isUniqueViolation(err)) {
        if (isUniqueViolation(err) && gtinNorm) {
          void (async () => {
            try {
              const conflicting = await this.findByTenantAndGtin(params.tenantId, gtinNorm);
              if (conflicting?.id) {
                await insertCanonicalProductEvent({
                  canonicalProductId: conflicting.id,
                  tenantId: params.tenantId,
                  eventType: 'gtin_collision_blocked',
                  payload: {
                    gtin: gtinNorm,
                    scope: 'scoped',
                    reason: 'unique_violation',
                    conflicting_id: conflicting.id,
                  },
                });
              }
            } catch {
              // Silencioso — evento de colisão não pode bloquear o retry.
            }
          })();
        }
        const byFp = await this.findIndustrialByFingerprintInputs(
          params.tenantId,
          gtinNorm,
          params.name,
          params.brand,
          attrsJson
        );
        if (byFp) {
          return byFp;
        }
        if (gtinNorm) {
          const existing = await this.findByTenantAndGtin(params.tenantId, gtinNorm);
          if (existing) {
            return existing;
          }
        }
      }
      throw err;
    }
  },

  async findIndustrialById(
    tenantId: string,
    canonicalProductId: string
  ): Promise<CanonicalProductPersistRow | null> {
    const idMatch = sqlCanonicalIdMatchesTenantContext('canonical_products', '$1::uuid');
    const row = await runQueryWithTenant<CanonicalProductDbRow>(
      tenantId,
      `
      SELECT ${CP_SELECT}
      FROM canonical_products
      WHERE id = $2 AND type = 'INDUSTRIAL'
        AND ${idMatch}
      LIMIT 1
      `,
      [tenantId, canonicalProductId]
    );
    return row ? toPersistRow(row) : null;
  },
};