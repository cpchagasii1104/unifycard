// product-visibility.service.ts
// §8 PLANO_FASE_ATUAL: produto visível = canônico READY + offer ativa + estoque disponível.
// §8.4: query dinâmica com índices. Sem view materializada até evidência de gargalo.
//
// DECISION-0117 (CP4) — DT-INVENTORY-PRODUCT-VISIBILITY-TENANT-WIDE-STOCK-PROJECTION FECHADA:
//   - O estoque projetado é do MERCHANT da oferta (im.actor_id = po.merchant_id) —
//     nunca mais soma tenant-wide (estoque de A não aparece na oferta de B).
//   - Unidades incompatíveis NÃO são somadas (im.unit = pv.sale_unit; bases
//     divergentes ficam FORA da soma — separar, não agregar silenciosamente — DECISION-0117 H).
//   - Oferta com variante canônica liga à variante TENANT correspondente
//     (pv.canonical_variant_id) — sem produto cartesiano entre variantes.
//   - Merchant de EMPRESA só aparece com KYB aprovado + publicação institucional
//     ATIVA (defesa direta no reader — não depende só de cascata). Merchant PF
//     (actors.company_id IS NULL) preserva o contrato legado (registrado no gate).
//   - Estoque zero: a OFERTA permanece existente (linha não é apagada); ela
//     apenas não aparece na lista pública (indisponível).

import { runQueriesWithTenant } from '@core/database/pool';
import {
  sqlCanonicalIndustrialOperationalReady,
  sqlCanonicalIdMatchesTenantContext,
  sqlOrderScopedCanonicalFirst,
} from '@core/catalog/canonical/canonical-product-readiness';

export interface VisibleProduct {
  productId: string;
  canonicalProductId: string;
  variantId: string;
  canonicalVariantId: string | null;
  offerId: string;
  merchantActorId: string;
  internalSku: string | null;
  saleUnit: string | null;
  /** Preço em centavos (da oferta ativa). */
  priceCents: number;
  /** Estoque DO MERCHANT da oferta (actor-scoped; unidade consistente). */
  availableQuantity: number;
  categoryId: string;
  name: string;
  brand: string | null;
  gtin: string | null;
  images: string[];
  attributes: Record<string, unknown>;
  scope: 'global' | 'scoped';
}

export interface ListVisibleProductsOptions {
  categoryIds?: string[];
  limit?: number;
  offset?: number;
}

export async function listVisibleProducts(
  tenantId: string,
  options: ListVisibleProductsOptions = {}
): Promise<VisibleProduct[]> {
  const { categoryIds, limit = 50, offset = 0 } = options;

  const cpVis   = sqlCanonicalIdMatchesTenantContext('cp', '$1::uuid');
  const cpReady = sqlCanonicalIndustrialOperationalReady('cp');
  const cpOrder = sqlOrderScopedCanonicalFirst('cp');

  // Construir filtro de categoria dinamicamente para evitar parâmetro NULL
  const params: unknown[] = [tenantId, limit, offset];
  let categoryFilter = '';
  if (categoryIds && categoryIds.length > 0) {
    params.push(categoryIds);
    categoryFilter = `AND cp.category_id = ANY($${params.length}::uuid[])`;
  }

  const query = `
    SELECT
      p.id                           AS product_id,
      cp.id                          AS canonical_product_id,
      pv.id                          AS variant_id,
      po.canonical_variant_id        AS canonical_variant_id,
      po.id                          AS offer_id,
      po.merchant_id                 AS merchant_actor_id,
      po.internal_sku                AS internal_sku,
      po.sale_unit                   AS sale_unit,
      po.price_cents                 AS price_cents,
      COALESCE(inv.stock_qty, po.available_quantity) AS available_quantity,
      cp.category_id,
      cp.name,
      cp.brand,
      cp.gtin,
      cp.images,
      cp.attributes,
      cp.scope
    FROM canonical_products cp
    JOIN products p
      ON p.canonical_product_id = cp.id
      AND p.tenant_id = $1::uuid
      AND p.category_id IS NOT NULL
    JOIN product_offers po
      ON po.product_id = p.id
      AND po.tenant_id = $1::uuid
      AND po.is_active = true
      AND po.status = 'active'
    JOIN product_variants pv
      ON pv.product_id = p.id
      AND pv.tenant_id = $1::uuid
      AND (po.canonical_variant_id IS NULL OR pv.canonical_variant_id = po.canonical_variant_id)
    -- Defesa direta do reader (DECISION-0117 / 0099-0101): merchant de EMPRESA
    -- exige KYB aprovado + publicação institucional ATIVA. PF = contrato legado.
    JOIN actors ma
      ON ma.id = po.merchant_id
    LEFT JOIN companies mc
      ON mc.company_id = ma.company_id
    LEFT JOIN fiscal_identities mfi
      ON mfi.fiscal_identity_id = mc.fiscal_identity_id
    LEFT JOIN LATERAL (
      -- Estoque DO MERCHANT da oferta (actor-scoped) com unidade CONSISTENTE
      -- (movimentos em unidade divergente NÃO somam — fail-closed por exclusão).
      SELECT SUM(
        CASE im.movement_type
          WHEN 'IN'         THEN  im.quantity
          WHEN 'OUT'        THEN -im.quantity
          WHEN 'ADJUSTMENT' THEN  im.quantity
          ELSE 0
        END
      ) AS stock_qty
      FROM inventory_movements im
      WHERE im.tenant_id          = $1::uuid
        AND im.product_variant_id = pv.id
        AND im.actor_id           = po.merchant_id
        AND im.unit               = pv.sale_unit
    ) inv ON true
    WHERE ${cpVis}
      AND cp.type = 'INDUSTRIAL'
      AND ${cpReady}
      ${categoryFilter}
      AND COALESCE(inv.stock_qty, po.available_quantity) > 0
      AND (
        ma.company_id IS NULL
        OR (
          mfi.kyb_status = 'approved'
          AND EXISTS (
            SELECT 1 FROM company_concept_publications ccp
             WHERE ccp.company_id = mc.company_id AND ccp.status = 'active'
          )
        )
      )
    ORDER BY ${cpOrder}, cp.name ASC
    LIMIT $2
    OFFSET $3
  `;

  type Row = {
    product_id: string;
    canonical_product_id: string;
    variant_id: string;
    canonical_variant_id: string | null;
    offer_id: string;
    merchant_actor_id: string;
    internal_sku: string | null;
    sale_unit: string | null;
    price_cents: string;
    available_quantity: string;
    category_id: string;
    name: string;
    brand: string | null;
    gtin: string | null;
    images: unknown;
    attributes: unknown;
    scope: string;
  };

  // runQueriesWithTenant retorna T[] (múltiplas linhas).
  // runQueryWithTenant retorna T|undefined (uma linha) — NÃO usar aqui.
  const rows = await runQueriesWithTenant<Row>(tenantId, query, params);

  return rows.map((r) => ({
    productId:          r.product_id,
    canonicalProductId: r.canonical_product_id,
    variantId:          r.variant_id,
    canonicalVariantId: r.canonical_variant_id ?? null,
    offerId:            r.offer_id,
    merchantActorId:    r.merchant_actor_id,
    internalSku:        r.internal_sku ?? null,
    saleUnit:           r.sale_unit ?? null,
    priceCents:         parseInt(r.price_cents, 10),
    availableQuantity:
      r.available_quantity != null ? parseInt(String(r.available_quantity), 10) : 0,
    categoryId:         r.category_id,
    name:               r.name,
    brand:              r.brand ?? null,
    gtin:               r.gtin ?? null,
    images:             Array.isArray(r.images)
                          ? r.images.filter((x): x is string => typeof x === 'string')
                          : [],
    attributes:         (r.attributes && typeof r.attributes === 'object' && !Array.isArray(r.attributes))
                          ? (r.attributes as Record<string, unknown>)
                          : {},
    scope:              r.scope as 'global' | 'scoped',
  }));
}
