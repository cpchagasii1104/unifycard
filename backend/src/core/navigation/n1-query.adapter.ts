/**
 * Leitura N1 → categories → concept_id (norma 19).
 * N1 não entra no GRAPH; este adapter só resolve concept_ids já ligados a categorias.
 */
import { pool } from '../database/pool';

export type ConceptRowByN1 = {
  conceptId: string;
  slug: string;
  domain: string;
};

/**
 * Conceitos distintos associados a categorias mapeadas para o N1 (slug + domain_key).
 * Categorias são globais; não filtra por tenant.
 */
export async function getConceptsByN1(domainKey: string, n1Slug: string): Promise<ConceptRowByN1[]> {
  const slug = n1Slug.trim().toLowerCase();
  const domain = domainKey.trim();
  if (!slug || !domain) {
    return [];
  }

  const r = await pool.query<{
    concept_id: string;
    slug: string;
    domain: string;
  }>(
    `
    SELECT DISTINCT c.concept_id, c.slug, c.domain
    FROM n1_nodes n1
    INNER JOIN category_n1_mapping m ON m.n1_id = n1.n1_id
    INNER JOIN categories cat ON cat.category_id = m.category_id
    INNER JOIN concepts c ON c.concept_id = cat.concept_id
    WHERE n1.domain_key = $1
      AND n1.slug = $2
      AND cat.concept_id IS NOT NULL
    ORDER BY c.slug
    `,
    [domain, slug]
  );

  return r.rows.map((row) => ({
    conceptId: row.concept_id,
    slug: row.slug,
    domain: row.domain,
  }));
}