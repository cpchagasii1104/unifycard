/**
 * READ de linhas comerciais (variante + produto) alinhadas a N1 + CONTEXT + N2.
 * Junção estrutural: category.slug = n2.slug (folha de catálogo alinhada ao nó N2); sem inferência de negócio por slug.
 */

import { runQueriesWithTenant } from '../database/pool';

export type NavigationOfferRow = {
  product_variant_id: string;
  product_id: string;
  product_name: string;
  sku: string;
};

export type ListOfferRowsForNavigationResult = {
  rows: NavigationOfferRow[];
  totalCount: number;
};

export async function listOfferRowsForNavigation(
  tenantId: string,
  params: {
    n1: string;
    context: string;
    n2: string;
    domain: string;
    limit: number;
    offset: number;
  }
): Promise<ListOfferRowsForNavigationResult> {
  const n1 = params.n1.trim().toLowerCase();
  const contextSlug = params.context.trim().toLowerCase();
  const n2 = params.n2.trim().toLowerCase();
  const domain = params.domain.trim();
  const limit = params.limit;
  const offset = params.offset;

  const rows = await runQueriesWithTenant<{
    product_variant_id: string;
    product_id: string;
    product_name: string;
    sku: string;
    total_count: string;
  }>(
    tenantId,
    `
    SELECT
      pv.id AS product_variant_id,
      p.id AS product_id,
      p.name AS product_name,
      pv.sku AS sku,
      COUNT(*) OVER()::text AS total_count
    FROM product_variants pv
    INNER JOIN products p
      ON p.tenant_id = pv.tenant_id AND p.id = pv.product_id
    INNER JOIN categories c
      ON c.category_id = p.category_id
      AND c.slug = $5
    INNER JOIN category_n1_mapping m ON m.category_id = c.category_id
    INNER JOIN n1_nodes n1 ON n1.n1_id = m.n1_id AND n1.slug = $2 AND n1.domain_key = $3
    INNER JOIN n2_nodes n2 ON n2.n1_id = n1.n1_id AND n2.slug = $5 AND n2.is_active = true
    INNER JOIN context_nodes cn
      ON cn.context_slug = $4
      AND cn.is_active = true
      AND cn.deprecated_at IS NULL
    INNER JOIN context_n2_mapping cnm ON cnm.context_id = cn.context_id AND cnm.n2_id = n2.n2_id
    WHERE pv.tenant_id = $1
      AND pv.is_active = true
      AND p.is_active = true
    ORDER BY p.name ASC, pv.sku ASC
    LIMIT $6 OFFSET $7
    `,
    [tenantId, n1, domain, contextSlug, n2, limit, offset]
  );

  const totalCount =
    rows.length > 0 ? Number.parseInt(rows[0].total_count, 10) : 0;

  return {
    rows: rows.map((r) => ({
      product_variant_id: r.product_variant_id,
      product_id: r.product_id,
      product_name: r.product_name,
      sku: r.sku,
    })),
    totalCount,
  };
}