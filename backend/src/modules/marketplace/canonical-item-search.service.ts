// canonical-item-search.service.ts
// F-GLOBAL-SEARCH-OMNI — extração do SELECT canônico de itens (antes inline em
// marketplace-canonical-search.routes.ts) para UM reader compartilhado (Lei de Coerência:
// a verdade da busca de item canônico existe UMA vez; a rota /catalog/items/search e o
// omnibox /search são CALLERS da mesma função, não duas queries paralelas).
//
// As regras de visibilidade/prontidão do catálogo continuam vindo dos helpers canônicos
// (canonical-product-readiness) — DECISION-0117 F/CP5: 1 resultado por IDENTIDADE canônica,
// só INDUSTRIAL operacionalmente READY, sem duplicados.

import { runQueriesWithTenant } from '@core/database/pool';
import {
  sqlCanonicalIndustrialOperationalReady,
  sqlCanonicalIdMatchesTenantContext,
  sqlOrderScopedCanonicalFirst,
} from '@core/catalog/canonical/canonical-product-readiness';

export interface CanonicalItemRow {
  id: string;
  name: string;
  brand: string | null;
  gtin: string | null;
  category_id: string | null;
  scope: string;
  images: unknown;
}

export async function searchCanonicalItems(
  tenantId: string,
  filters: { q?: string; categoryId?: string; limit?: number }
): Promise<CanonicalItemRow[]> {
  const q = String(filters.q ?? '').trim();
  const limit = Math.min(filters.limit ?? 20, 50);

  const cpVis = sqlCanonicalIdMatchesTenantContext('cp', '$1::uuid');
  const cpReady = sqlCanonicalIndustrialOperationalReady('cp');
  const cpOrder = sqlOrderScopedCanonicalFirst('cp');
  const params: unknown[] = [tenantId, limit];
  let filter = '';
  if (q) {
    params.push(`%${q}%`);
    filter += ` AND (cp.name ILIKE $${params.length} OR cp.brand ILIKE $${params.length})`;
  }
  if (filters.categoryId) {
    params.push(filters.categoryId);
    filter += ` AND cp.category_id = $${params.length}::uuid`;
  }

  return runQueriesWithTenant<CanonicalItemRow>(
    tenantId,
    `SELECT cp.id, cp.name, cp.brand, cp.gtin, cp.category_id, cp.scope, cp.images
       FROM canonical_products cp
      WHERE ${cpVis} AND cp.type = 'INDUSTRIAL' AND ${cpReady}
        AND cp.duplicate_of_canonical_product_id IS NULL
        AND COALESCE(cp.attributes->>'catalog_scaffold', '') <> 'true'
        ${filter}
      ORDER BY ${cpOrder}, cp.name ASC
      LIMIT $2`,
    params
  );
  // ↑ catalog_scaffold: âncoras N1-root do bloco3 (data-repair 20260518120000) são estrutura de
  //   catálogo, não produto vendável — marcadas por 20260703140000 e EXCLUÍDAS da descoberta
  //   (as duas superfícies: /catalog/items/search + omnibox). A âncora segue viva no dado.
}
