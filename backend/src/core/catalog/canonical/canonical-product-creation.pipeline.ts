// canonical-product-creation.pipeline.ts
// Pipeline de criação/reuso de `canonical_products` INDUSTRIAL com deps injetáveis (testes sem mock de módulo).
// Sem resolução automática de concept; fila humana opcional via hook.

import { HttpError } from '@core/errors/http-error';
import type { CanonicalProductPersistRow } from './canonical-product.repository';

export interface GetOrCreateCanonicalProductInput {
  tenantId: string;
  name: string;
  brand?: string | null;
  gtin?: string | null;
  categoryId: string;
  images?: string[];
  attributes?: Record<string, unknown>;
}

export interface GetOrCreateCanonicalProductResult {
  row: CanonicalProductPersistRow;
  created: boolean;
}

export interface CanonicalProductCreationRepository {
  findByTenantAndGtin(tenantId: string, gtin: string): Promise<CanonicalProductPersistRow | null>;
  findByTenantNameBrandCategory(
    tenantId: string,
    name: string,
    brand: string | null,
    categoryId: string
  ): Promise<CanonicalProductPersistRow | null>;
  insertIndustrial(params: {
    tenantId: string;
    gtin: string | null;
    name: string;
    brand: string | null;
    categoryId: string;
    images?: unknown;
    attributes?: unknown;
  }): Promise<CanonicalProductPersistRow>;
  /** Mesmo INSERT + fila pending na mesma transação (governança normativa). */
  insertIndustrialWithPendingConceptQueue?(params: {
    tenantId: string;
    gtin: string | null;
    name: string;
    brand: string | null;
    categoryId: string;
    images?: unknown;
    attributes?: unknown;
  }): Promise<CanonicalProductPersistRow>;
  findIndustrialById(tenantId: string, canonicalProductId: string): Promise<CanonicalProductPersistRow | null>;
}

/** Fila humana quando novo INDUSTRIAL fica sem concept_id. */
export interface CanonicalProductCreationHooks {
  onIndustrialCreatedUnresolved?: (ctx: {
    tenantId: string;
    canonicalProductId: string;
  }) => Promise<void>;
}

function normalizeGtin(value?: string | null): string | null {
  if (value == null) return null;
  const t = String(value).trim();
  return t === '' ? null : t;
}

function normalizeBrand(value?: string | null): string | null {
  if (value == null) return null;
  const t = String(value).trim();
  return t === '' ? null : t;
}

/**
 * 1) GTIN não vazio → lookup por tenant+gtin.
 * 2) Senão → match forte nome + marca + category_id.
 * 3) Senão → INSERT INDUSTRIAL; se sem concept_id, hook de fila (sem heurística).
 */
export async function getOrCreateIndustrialWithDeps(
  repo: CanonicalProductCreationRepository,
  input: GetOrCreateCanonicalProductInput,
  hooks?: CanonicalProductCreationHooks
): Promise<GetOrCreateCanonicalProductResult> {
  const name = String(input.name ?? '').trim();
  if (!name) {
    throw HttpError.badRequest('Nome do produto canónico é obrigatório.');
  }

  const tenantId = input.tenantId;
  const categoryId = String(input.categoryId ?? '').trim();
  if (!categoryId) {
    throw HttpError.badRequest('categoryId é obrigatório.');
  }

  const gtin = normalizeGtin(input.gtin);
  const brand = normalizeBrand(input.brand);

  if (gtin) {
    const byGtin = await repo.findByTenantAndGtin(tenantId, gtin);
    if (byGtin) {
      return { row: byGtin, created: false };
    }
  }

  const byName = await repo.findByTenantNameBrandCategory(tenantId, name, brand, categoryId);
  if (byName) {
    return { row: byName, created: false };
  }

  if (hooks?.onIndustrialCreatedUnresolved && repo.insertIndustrialWithPendingConceptQueue) {
    const row = await repo.insertIndustrialWithPendingConceptQueue({
      tenantId,
      gtin,
      name,
      brand,
      categoryId,
      images: input.images,
      attributes: input.attributes,
    });
    return { row, created: true };
  }

  const row = await repo.insertIndustrial({
    tenantId,
    gtin,
    name,
    brand,
    categoryId,
    images: input.images,
    attributes: input.attributes,
  });

  if (!row.conceptId && hooks?.onIndustrialCreatedUnresolved) {
    await hooks.onIndustrialCreatedUnresolved({
      tenantId,
      canonicalProductId: row.id,
    });
  }
  return { row, created: true };
}