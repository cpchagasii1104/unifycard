// product-visibility.service.ts
// §8 PLANO_FASE_ATUAL: produto visível = canônico READY + offer ativa + estoque disponível.
// §8.4: query dinâmica com índices. Sem view materializada até evidência de gargalo.
//
// NÃO usar para checkout crítico sem validação por actor
//
// LIMITAÇÃO CONHECIDA — v1 (documentada intencionalmente):
//   Stock agregado por (tenant_id, product_variant_id) — soma TODAS as unidades (actors).
//   Não filtra por actor_id da oferta (merchant_id).
//   Isso pode mostrar estoque de seller A para oferta de seller B.
//   AVISO: não usar para checkout crítico sem evoluir para filtro por actor_id.
//   Evoluir quando produto exigir visibilidade por unidade (FASE F — próxima iteração).

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
  offerId: string;
  /** Preço em centavos (da oferta ativa). */
  priceCents: number;
  /**
   * Stock total da variante no tenant — v1: soma todas as unidades.
   * Não reflete disponibilidade por actor/unidade específica da oferta.
   */
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
      po.id                          AS offer_id,
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
    JOIN product_variants pv
      ON pv.product_id = p.id
      AND pv.tenant_id = $1::uuid
    JOIN product_offers po
      ON po.product_id = p.id
      AND po.tenant_id = $1::uuid
      AND po.is_active = true
    LEFT JOIN LATERAL (
      -- Campo correto: movement_type (SSOT)
      -- v1: stock agregado por variante — soma todas as unidades (actors).
      -- Limitação documentada: ver cabeçalho do arquivo.
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
    ) inv ON true
    WHERE ${cpVis}
      AND cp.type = 'INDUSTRIAL'
      AND ${cpReady}
      ${categoryFilter}
      AND COALESCE(inv.stock_qty, po.available_quantity) > 0
    ORDER BY ${cpOrder}, cp.name ASC
    LIMIT $2
    OFFSET $3
  `;

  type Row = {
    product_id: string;
    canonical_product_id: string;
    variant_id: string;
    offer_id: string;
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
    offerId:            r.offer_id,
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