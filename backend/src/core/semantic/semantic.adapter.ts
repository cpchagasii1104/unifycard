/**
 * Camada de leitura semântica (transição Lei 7): concept_id como identidade.
 * Não é serviço de domínio — apenas helpers de resolução para migração gradual.
 *
 * Projeção futura (sem migração ainda): várias linhas em `categories` poderão apontar
 * para o mesmo `concept_id` (mesma identidade semântica, navegações distintas).
 * A inferência já trata concept como SSOT; normalização de dados virá em migration dedicada.
 */
import { pool } from '@core/database/pool';

export interface SemanticConceptResolution {
  categoryId: string | null;
  conceptId: string | null;
}

/** Placeholder de modelo: 1 concept → N category_ids (projeções). Só documentação / tipagem por ora. */
export type ConceptMultiProjection = {
  conceptId: string;
  categoryIds: string[];
};

/** Cache por request (Map compartilhado): chaves `c:${categoryId}` e `s:${slug}` */
export type SemanticResolutionCache = Map<string, SemanticConceptResolution>;

export function createSemanticResolutionCache(): SemanticResolutionCache {
  return new Map();
}

function cacheKeyCategory(categoryId: string): string {
  return `c:${categoryId}`;
}

function cacheKeySlug(slug: string): string {
  return `s:${slug}`;
}

/**
 * Resolve concept_id a partir de uma categoria já conhecida.
 */
export async function resolveConceptFromCategory(categoryId: string): Promise<SemanticConceptResolution> {
  const result = await pool.query<{ concept_id: string | null }>(
    `SELECT concept_id FROM categories WHERE category_id = $1::uuid`,
    [categoryId],
  );
  const row = result.rows[0];
  return {
    categoryId,
    conceptId: row?.concept_id ?? null,
  };
}

/**
 * Resolve categoria + concept_id por slug global (UNIQUE(slug) em categories).
 */
export async function resolveConceptFromSlug(slug: string): Promise<SemanticConceptResolution> {
  const result = await pool.query<{ category_id: string; concept_id: string | null }>(
    `
    SELECT category_id, concept_id
    FROM categories
    WHERE slug = $1
    LIMIT 1
    `,
    [slug],
  );
  const row = result.rows[0];
  if (!row) {
    return { categoryId: null, conceptId: null };
  }
  return {
    categoryId: row.category_id,
    conceptId: row.concept_id ?? null,
  };
}

export async function resolveConceptFromCategoryCached(
  categoryId: string,
  cache: SemanticResolutionCache,
): Promise<SemanticConceptResolution> {
  const key = cacheKeyCategory(categoryId);
  const hit = cache.get(key);
  if (hit) {
    return hit;
  }
  const r = await resolveConceptFromCategory(categoryId);
  cache.set(key, r);
  return r;
}

export async function resolveConceptFromSlugCached(
  slug: string,
  cache: SemanticResolutionCache,
): Promise<SemanticConceptResolution> {
  const key = cacheKeySlug(slug);
  const hit = cache.get(key);
  if (hit) {
    return hit;
  }
  const r = await resolveConceptFromSlug(slug);
  cache.set(key, r);
  return r;
}

// ============================================================
// PONTE DE BUSCA termo→CONCEPT (F-SERVICE-SEARCH-ALIAS-DISCOVERY) — terceiro hop de LEITURA.
// Um termo de ocupação/linguagem comum ("cabeleireiro", "barbeiro") aponta para concept(s) JÁ
// existentes em service_search_aliases. ADVISORY e READ-ONLY: só SELECT, nunca INSERT. O alias
// NÃO cria significado; o texto digitado NUNCA vira concept; o lado-valor é sempre concept_id.
// ============================================================

/**
 * Normaliza um termo de busca livre para a CHAVE de lookup (mesma regra usada no seed da
 * tabela service_search_aliases): minúsculas, sem acento, kebab. Determinística e estável.
 * Ex.: "Salão de Beleza" → "salao-de-beleza"; "  Cabeleireiro " → "cabeleireiro".
 */
export function normalizeSearchTerm(raw: string): string {
  return (raw ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface SearchTermConceptResolution {
  /** termo normalizado efetivamente buscado (chave de lookup). */
  normalizedTerm: string;
  /** concepts candidatos (advisory). Vazio = miss honesto; runtime NÃO inventa nada. */
  conceptIds: string[];
}

/**
 * Resolve um termo de busca livre para concept(s) candidatos via ponte advisory
 * service_search_aliases. SOMENTE pontes vivas e curadas (is_active + review_status='approved').
 * READ-ONLY: jamais escreve. Miss → conceptIds vazio (descoberta honesta, sem fabricar concept).
 */
export async function resolveConceptsFromSearchTerm(
  rawTerm: string,
): Promise<SearchTermConceptResolution> {
  const normalizedTerm = normalizeSearchTerm(rawTerm);
  if (!normalizedTerm) {
    return { normalizedTerm, conceptIds: [] };
  }
  // UNIQUE(normalized_term, concept_id) já garante 1 linha por concept neste termo — sem DISTINCT.
  const result = await pool.query<{ concept_id: string }>(
    `
    SELECT a.concept_id
    FROM service_search_aliases a
    WHERE a.normalized_term = $1
      AND a.is_active = true
      AND a.review_status = 'approved'
    ORDER BY
      CASE a.confidence WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
      a.concept_id
    `,
    [normalizedTerm],
  );
  return {
    normalizedTerm,
    conceptIds: result.rows.map((r) => r.concept_id),
  };
}

export interface ConceptLabelRow {
  conceptId: string;
  slug: string;
  domain: string;
  /** Display name governado (concept_labels primária pt-BR/default) — APRESENTAÇÃO, nunca identidade. */
  displayName: string | null;
  shortLabel: string | null;
}

/**
 * Resolve rótulo de APRESENTAÇÃO (concept_labels primária pt-BR/default) + slug/domain para um conjunto
 * de concept_ids. READ-ONLY (só SELECT). Label é apresentação, NÃO identidade (DECISION-0107): o value
 * segue concept_id/slug; o WHERE é por concept_id (nunca por label). Fallback honesto: sem label → null
 * (frontend faz displayName ?? slug). concepts/concept_labels são GLOBAIS (sem tenant) — pool direto,
 * igual a resolveConceptsFromSearchTerm. NÃO ordena (o caller preserva a ordem de confiança do alias).
 */
export async function resolveConceptLabels(conceptIds: string[]): Promise<ConceptLabelRow[]> {
  if (!conceptIds.length) {
    return [];
  }
  const result = await pool.query<{
    concept_id: string;
    slug: string;
    domain: string;
    display_name: string | null;
    short_label: string | null;
  }>(
    `
    SELECT c.concept_id, c.slug, c.domain, cl.label AS display_name, cl.short_label
    FROM concepts c
    LEFT JOIN concept_labels cl
      ON cl.concept_id = c.concept_id
     AND cl.locale = 'pt-BR' AND cl.context_key = 'default' AND cl.is_primary = true
    WHERE c.concept_id = ANY($1::uuid[])
    `,
    [conceptIds],
  );
  return result.rows.map((r) => ({
    conceptId: r.concept_id,
    slug: r.slug,
    domain: r.domain,
    displayName: r.display_name ?? null,
    shortLabel: r.short_label ?? null,
  }));
}