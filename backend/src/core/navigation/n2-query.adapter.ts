/**
 * Leitura N1 + CONTEXT → N2 (norma 20). Somente navegação; não inferir semântica pelo slug.
 */
import { pool } from '../database/pool';

export type N2DisplayName = {
  locale: string;
  value: string;
  priority: number;
};

export type N2ByContextRow = {
  n2Id: string;
  slug: string;
  sortOrder: number;
  isDefault: boolean;
  displayNames: N2DisplayName[];
};

/**
 * Resolve N1 por slug + domain_key. Retorna null se não existir (evita query vazia silenciosa sem checagem).
 */
export async function getN1IdBySlugAndDomain(
  n1Slug: string,
  domainKey: string
): Promise<string | null> {
  const slug = n1Slug.trim().toLowerCase();
  const dk = domainKey.trim();
  if (!slug || !dk) {
    return null;
  }
  const r = await pool.query<{ n1_id: string }>(
    `SELECT n1_id FROM n1_nodes WHERE slug = $1 AND domain_key = $2 LIMIT 1`,
    [slug, dk]
  );
  return r.rows[0]?.n1_id ?? null;
}

/**
 * N2 ativos para um N1 e context_slug governado (via context_n2_mapping).
 */
export async function getN2ByContext(
  n1Slug: string,
  contextSlug: string,
  options?: { domainKey?: string; locale?: string }
): Promise<N2ByContextRow[]> {
  const slug = n1Slug.trim().toLowerCase();
  const ctx = contextSlug.trim().toLowerCase();
  const domainKey = (options?.domainKey ?? 'produtos-e-comercio').trim();
  const locale = (options?.locale ?? 'pt-BR').trim() || 'pt-BR';

  if (!slug || !ctx || !domainKey) {
    return [];
  }

  const { rows } = await pool.query<{
    n2_id: string;
    n2_slug: string;
    sort_order: number;
    is_default: boolean;
    display_value: string | null;
  }>(
    `
    SELECT
      n2.n2_id,
      n2.slug AS n2_slug,
      m.sort_order,
      m.is_default,
      (
        SELECT l.value
        FROM n2_localized_names l
        WHERE l.n2_id = n2.n2_id
          AND l.locale = $4
        ORDER BY l.priority ASC
        LIMIT 1
      ) AS display_value
    FROM n1_nodes n1
    INNER JOIN n2_nodes n2 ON n2.n1_id = n1.n1_id AND n2.is_active = true
    INNER JOIN context_nodes cn
      ON cn.context_slug = $3
      AND cn.is_active = true
      AND cn.deprecated_at IS NULL
    INNER JOIN context_n2_mapping m
      ON m.context_id = cn.context_id
      AND m.n2_id = n2.n2_id
    WHERE n1.slug = $1
      AND n1.domain_key = $2
    ORDER BY m.sort_order ASC, n2.slug ASC
    `,
    [slug, domainKey, ctx, locale]
  );

  return rows.map((row) => ({
    n2Id: row.n2_id,
    slug: row.n2_slug,
    sortOrder: row.sort_order,
    isDefault: row.is_default,
    displayNames:
      row.display_value != null
        ? [{ locale, value: row.display_value, priority: 1 }]
        : [],
  }));
}