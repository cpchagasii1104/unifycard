/**
 * Leitura do grafo semântico (global).
 *
 * Ordem: `concept_relations` (concept → concept); se não houver linhas para a origem,
 * `category_relations` projetado em concept_id (fallback).
 */
import { pool } from '@core/database/pool';

export type GraphRelationType = 'enables' | 'evolves_to' | 'related_to';

export interface ConceptRelation {
  /** concept_id da categoria destino (to_category_id) */
  relatedConceptId: string;
  relationType: GraphRelationType;
  /** Categoria destino canónica da aresta (para montar sugestão sem novo lookup por slug) */
  toCategoryId: string;
}

export type GraphCategoryRow = {
  categoryId: string;
  slug: string;
  name: string;
  path: string[];
  conceptId: string | null;
};

async function pickCategoryForConcept(conceptId: string): Promise<string | null> {
  const r = await pool.query<{ category_id: string }>(
    `
    SELECT category_id
    FROM categories
    WHERE concept_id = $1::uuid
    ORDER BY updated_at DESC NULLS LAST
    LIMIT 1
    `,
    [conceptId]
  );
  return r.rows[0]?.category_id ?? null;
}

async function getRelatedConceptsFromCategoryGraph(
  fromConceptId: string,
  types: readonly GraphRelationType[] | null
): Promise<ConceptRelation[]> {
  const r = await pool.query<{
    related_concept_id: string;
    relation_type: GraphRelationType;
    to_category_id: string;
  }>(
    `
    SELECT DISTINCT ON (cr.to_category_id, cr.relation_type)
      ct.concept_id AS related_concept_id,
      cr.relation_type,
      cr.to_category_id
    FROM category_relations cr
    INNER JOIN categories cf ON cf.category_id = cr.from_category_id
    INNER JOIN categories ct ON ct.category_id = cr.to_category_id
    WHERE cf.concept_id = $1::uuid
      AND ct.concept_id IS NOT NULL
      AND ($2::text[] IS NULL OR cr.relation_type = ANY($2::text[]))
    ORDER BY cr.to_category_id, cr.relation_type, cr.weight DESC NULLS LAST
    `,
    [fromConceptId, types && types.length > 0 ? [...types] : null]
  );
  return r.rows.map((row) => ({
    relatedConceptId: row.related_concept_id,
    relationType: row.relation_type,
    toCategoryId: row.to_category_id,
  }));
}

/**
 * Arestas de saída cujo lado "from" é o concept_id de origem.
 *
 * Se existir **pelo menos uma** linha em `concept_relations` para esse subject+tipos,
 * usa-se só essa camada. Caso contrário, fallback em `category_relations`.
 */
export async function getRelatedConcepts(
  fromConceptId: string,
  options?: { relationTypes?: readonly GraphRelationType[] }
): Promise<ConceptRelation[]> {
  const types = options?.relationTypes ?? null;

  const raw = await pool.query<{
    object_concept_id: string;
    relation_type: GraphRelationType;
  }>(
    `
    SELECT object_concept_id, relation_type
    FROM concept_relations
    WHERE subject_concept_id = $1::uuid
      AND ($2::text[] IS NULL OR relation_type = ANY($2::text[]))
    ORDER BY weight DESC, relation_id
    `,
    [fromConceptId, types && types.length > 0 ? [...types] : null]
  );

  if (raw.rows.length === 0) {
    return getRelatedConceptsFromCategoryGraph(fromConceptId, types);
  }

  const out: ConceptRelation[] = [];
  for (const row of raw.rows) {
    const toCategoryId = await pickCategoryForConcept(row.object_concept_id);
    if (!toCategoryId) {
      continue;
    }
    out.push({
      relatedConceptId: row.object_concept_id,
      relationType: row.relation_type,
      toCategoryId,
    });
  }
  return out;
}

export async function getCategoryRow(categoryId: string): Promise<GraphCategoryRow | null> {
  const r = await pool.query<{
    category_id: string;
    slug: string;
    name: string;
    path: string[] | null;
    concept_id: string | null;
  }>(
    `
    SELECT category_id, slug, name, path, concept_id
    FROM categories
    WHERE category_id = $1::uuid
    LIMIT 1
    `,
    [categoryId]
  );
  const row = r.rows[0];
  if (!row) {
    return null;
  }
  return {
    categoryId: row.category_id,
    slug: row.slug,
    name: row.name,
    path: row.path || [],
    conceptId: row.concept_id ?? null,
  };
}