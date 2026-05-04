// Camada de transição: IDs legado (product / variant) → concept_ref + offer_ref (arquitetura).
// Identidade semântica (concept_ref) vem apenas de canonical_products → concept_id (Lei 7: categoria não é identidade).

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { sqlCanonicalIdMatchesTenantContext } from '@core/catalog/canonical/canonical-product-readiness';
import { productRepository } from '../product.repository';
import { productVariantRepository } from '../product-variant.repository';

export type ConceptOfferResolution = 'ok' | 'partial' | 'failed';

/** Causas possíveis de falha na resolução semântica (C.5 / plano 5C). */
export type ConceptRefFailureReason =
  | 'CANONICAL_ROW_MISSING' // UUID inexistente ou invisível no contexto (sem linha)
  | 'CANONICAL_NOT_READY' // linha visível mas não cumpre predicado READY industrial
  | 'CONCEPT_ID_NULL' // INDUSTRIAL visível com concept_id NULL
  | 'SCOPE_TENANT_MISMATCH' // linha existe na BD mas fora do contexto tenant/global esperado
  | 'PRODUCT_MISSING_CANONICAL_ID' // produto industrial sem canonical_product_id
  | 'PRODUCT_NOT_FOUND'
  | 'VARIANT_NOT_FOUND';

export interface ConceptOfferRefs {
  /** UUID do conceito (SSOT) via canonical_products.concept_id quando INDUSTRIAL READY. */
  concept_ref: string | null;
  /** Surrogate: UUID da product_variant até existir entidade Offer explícita. */
  offer_ref: string | null;
  resolution: ConceptOfferResolution;
  /** Presente quando resolution = 'failed' (§19.1 camelCase em TS). */
  failureReason?: ConceptRefFailureReason;
}

function computeResolution(concept_ref: string | null, offer_ref: string | null): ConceptOfferResolution {
  if (concept_ref && offer_ref) return 'ok';
  if (concept_ref && !offer_ref) return 'partial';
  return 'failed';
}

function isIndustrialProduct(product: { productType: string }): boolean {
  return product.productType === 'industrial';
}

function failed(
  failureReason: ConceptRefFailureReason,
  offer_ref: string | null = null
): ConceptOfferRefs {
  return {
    concept_ref: null,
    offer_ref,
    resolution: 'failed',
    failureReason,
  };
}

/** Visibilidade alinhada a sqlCanonicalIdMatchesTenantContext (TS). */
function canonicalVisibleForTenant(
  row: { scope: string; tenant_id: string | null },
  tenantId: string
): boolean {
  if (row.scope === 'scoped' && row.tenant_id === tenantId) return true;
  if (row.scope === 'global' && row.tenant_id == null) return true;
  return false;
}

type CanonicalDiagnosticRow = {
  id: string;
  type: string | null;
  concept_id: string | null;
  concept_resolution_status: string | null;
  name: string | null;
  category_id: string | null;
};

function failureReasonFromVisibleCanonicalRow(row: CanonicalDiagnosticRow): ConceptRefFailureReason {
  if (row.type !== 'INDUSTRIAL') return 'CANONICAL_NOT_READY';
  if (row.concept_id == null || String(row.concept_id).trim() === '') return 'CONCEPT_ID_NULL';
  if (row.concept_resolution_status !== 'confirmed') return 'CANONICAL_NOT_READY';
  if (!row.name || String(row.name).trim() === '') return 'CANONICAL_NOT_READY';
  if (row.category_id == null || String(row.category_id).trim() === '') return 'CANONICAL_NOT_READY';
  return 'CANONICAL_NOT_READY';
}

async function diagnoseCanonicalPointer(
  tenantId: string,
  canonicalProductId: string
): Promise<ConceptRefFailureReason> {
  const bare = await runQueryWithTenant<{ scope: string; tenant_id: string | null }>(
    tenantId,
    `
    SELECT cp.scope::text AS scope, cp.tenant_id::text AS tenant_id
    FROM canonical_products cp
    WHERE cp.id = $1::uuid
    LIMIT 1
    `,
    [canonicalProductId]
  );
  if (!bare) return 'CANONICAL_ROW_MISSING';
  if (!canonicalVisibleForTenant(bare, tenantId)) return 'SCOPE_TENANT_MISMATCH';
  return 'CANONICAL_NOT_READY';
}

/**
 * Classifica canónico visível (já filtrado por contexto tenant/global).
 * Se a linha cumpre READY industrial, devolve concept_ref; senão a causa de falha.
 */
async function resolveVisibleCanonicalToConceptRef(
  tenantId: string,
  canonicalProductId: string
): Promise<{ concept_ref: string } | { failureReason: ConceptRefFailureReason }> {
  const tenantMatch = sqlCanonicalIdMatchesTenantContext('cp', '$2::uuid');
  const row = await runQueryWithTenant<CanonicalDiagnosticRow>(
    tenantId,
    `
    SELECT
      cp.id::text AS id,
      cp.type::text AS type,
      cp.concept_id::text AS concept_id,
      cp.concept_resolution_status::text AS concept_resolution_status,
      cp.name::text AS name,
      cp.category_id::text AS category_id
    FROM canonical_products cp
    WHERE cp.id = $1::uuid
      AND ${tenantMatch}
    LIMIT 1
    `,
    [canonicalProductId, tenantId]
  );

  if (!row) {
    return { failureReason: await diagnoseCanonicalPointer(tenantId, canonicalProductId) };
  }

  if (
    row.type === 'INDUSTRIAL' &&
    row.concept_id != null &&
    String(row.concept_id).trim() !== '' &&
    row.concept_resolution_status === 'confirmed' &&
    row.name != null &&
    String(row.name).trim() !== '' &&
    row.category_id != null &&
    String(row.category_id).trim() !== ''
  ) {
    return { concept_ref: String(row.concept_id) };
  }

  return { failureReason: failureReasonFromVisibleCanonicalRow(row) };
}

/**
 * Resolve concept_ref a partir de product.canonical_product_id → canonical_products (sem categoria).
 */
export async function resolveConceptFromProduct(
  productId: string,
  tenantId: string
): Promise<ConceptOfferRefs> {
  const product = await productRepository.getProductById(tenantId, productId);
  if (!product) {
    return failed('PRODUCT_NOT_FOUND');
  }

  if (isIndustrialProduct(product) && !product.canonicalProductId) {
    return failed('PRODUCT_MISSING_CANONICAL_ID');
  }

  const cid = product.canonicalProductId != null ? String(product.canonicalProductId).trim() : '';
  if (!cid) {
    return failed('CANONICAL_NOT_READY');
  }

  const resolved = await resolveVisibleCanonicalToConceptRef(tenantId, cid);
  if ('failureReason' in resolved) {
    return failed(resolved.failureReason);
  }

  const concept_ref = resolved.concept_ref;
  return {
    concept_ref,
    offer_ref: null,
    resolution: computeResolution(concept_ref, null),
  };
}

/**
 * Resolve concept_ref + offer_ref: variant → product → canonical_products → concept_id (READY).
 */
export async function resolveRefsFromVariant(
  productVariantId: string,
  tenantId: string
): Promise<ConceptOfferRefs> {
  const variant = await productVariantRepository.getVariantById(tenantId, productVariantId);
  if (!variant) {
    return failed('VARIANT_NOT_FOUND');
  }

  const offer_ref = variant.id;
  const product = await productRepository.getProductById(tenantId, variant.productId);
  if (!product) {
    return failed('PRODUCT_NOT_FOUND', offer_ref);
  }

  if (isIndustrialProduct(product) && !product.canonicalProductId) {
    return failed('PRODUCT_MISSING_CANONICAL_ID', offer_ref);
  }

  const cid = product.canonicalProductId != null ? String(product.canonicalProductId).trim() : '';
  if (!cid) {
    return failed('CANONICAL_NOT_READY', offer_ref);
  }

  const resolved = await resolveVisibleCanonicalToConceptRef(tenantId, cid);
  if ('failureReason' in resolved) {
    return failed(resolved.failureReason, offer_ref);
  }

  return {
    concept_ref: resolved.concept_ref,
    offer_ref,
    resolution: 'ok',
  };
}

type BatchRow = {
  variant_id: string;
  canonical_product_id: string | null;
  product_type: string | null;
  cp_id: string | null;
  cp_type: string | null;
  concept_id: string | null;
  concept_resolution_status: string | null;
  cp_name: string | null;
  cp_category_id: string | null;
};

/**
 * Resolução em lote: mesma semântica que resolveRefsFromVariant; sem concept READY → failed + failureReason.
 */
export async function resolveRefsBatchFromVariants(
  tenantId: string,
  variantIds: string[]
): Promise<Map<string, ConceptOfferRefs>> {
  const unique = [...new Set(variantIds.filter(Boolean))];
  const out = new Map<string, ConceptOfferRefs>();

  if (unique.length === 0) {
    return out;
  }

  const cpTenant = sqlCanonicalIdMatchesTenantContext('cp', 'p.tenant_id');

  const rows = await runQueriesWithTenant<BatchRow>(
    tenantId,
    `
    SELECT
      pv.id::text AS variant_id,
      p.canonical_product_id::text AS canonical_product_id,
      p.product_type::text AS product_type,
      cp.id::text AS cp_id,
      cp.type::text AS cp_type,
      cp.concept_id::text AS concept_id,
      cp.concept_resolution_status::text AS concept_resolution_status,
      cp.name::text AS cp_name,
      cp.category_id::text AS cp_category_id
    FROM product_variants pv
    INNER JOIN products p
      ON p.tenant_id = pv.tenant_id AND p.id = pv.product_id
    LEFT JOIN canonical_products cp
      ON cp.id = p.canonical_product_id
      AND ${cpTenant}
    WHERE pv.tenant_id = $1
      AND pv.id = ANY($2::uuid[])
    `,
    [tenantId, unique]
  );

  const rowByVariant = new Map(rows.map((r) => [r.variant_id, r]));

  for (const vid of unique) {
    const row = rowByVariant.get(vid);
    if (!row) {
      out.set(vid, failed('VARIANT_NOT_FOUND'));
      continue;
    }

    const offer_ref = vid;
    const pType = row.product_type ?? '';

    if (pType === 'industrial' && (!row.canonical_product_id || row.canonical_product_id.trim() === '')) {
      out.set(vid, failed('PRODUCT_MISSING_CANONICAL_ID', offer_ref));
      continue;
    }

    const cid = row.canonical_product_id != null ? String(row.canonical_product_id).trim() : '';
    if (!cid) {
      out.set(vid, failed('CANONICAL_NOT_READY', offer_ref));
      continue;
    }

    if (!row.cp_id) {
      const reason = await diagnoseCanonicalPointer(tenantId, cid);
      out.set(vid, failed(reason, offer_ref));
      continue;
    }

    const synthetic: CanonicalDiagnosticRow = {
      id: row.cp_id,
      type: row.cp_type,
      concept_id: row.concept_id,
      concept_resolution_status: row.concept_resolution_status,
      name: row.cp_name,
      category_id: row.cp_category_id,
    };

    if (
      synthetic.type === 'INDUSTRIAL' &&
      synthetic.concept_id != null &&
      String(synthetic.concept_id).trim() !== '' &&
      synthetic.concept_resolution_status === 'confirmed' &&
      synthetic.name != null &&
      String(synthetic.name).trim() !== '' &&
      synthetic.category_id != null &&
      String(synthetic.category_id).trim() !== ''
    ) {
      out.set(vid, {
        concept_ref: String(synthetic.concept_id),
        offer_ref,
        resolution: 'ok',
      });
      continue;
    }

    out.set(vid, failed(failureReasonFromVisibleCanonicalRow(synthetic), offer_ref));
  }

  return out;
}