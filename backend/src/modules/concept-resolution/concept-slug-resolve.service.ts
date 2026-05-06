/**
 * Resolver canónico read-only: (slug + domain N0) → concept_id.
 *
 * Regras:
 * - Sem fallback entre domínios; sem "primeiro resultado".
 * - `UNIQUE(domain, slug)` garante 0 ou 1 linha; se 2+ → invariante violada (fail-closed).
 * - Concept sem domain explícito (via context ou domain) = uso incorreto desta API.
 */

import { pool } from '@core/database/pool';
import { normalizeConceptSlug } from '@core/ontology/concept-governance.service';

import { getDefaultConceptDomain } from './concept-resolution-context';
import type {
  ConceptSlugResolveResult,
  ConceptResolutionContext,
  ResolveConceptSlugInput,
} from './concept-resolution.types';

function resolveDomain(input: ResolveConceptSlugInput): string {
  if ('domain' in input) {
    return input.domain.trim();
  }
  return getDefaultConceptDomain(input.context as ConceptResolutionContext);
}

/**
 * Resolve slug no domínio N0 esperado. Read-only.
 *
 * O slug é normalizado com a mesma função da governança de conceitos (07).
 */
export async function resolveConceptSlug(input: ResolveConceptSlugInput): Promise<ConceptSlugResolveResult> {
  const rawDomain = resolveDomain(input);
  const domain = rawDomain.trim();
  const normalizedSlug = normalizeConceptSlug(input.slug);

  if (!domain) {
    return {
      status: 'unresolved',
      slug: input.slug.trim(),
      domain: '',
      reason: 'missing_domain',
    };
  }

  if (!normalizedSlug) {
    return {
      status: 'unresolved',
      slug: input.slug.trim(),
      domain,
      reason: 'invalid_slug',
    };
  }

  const r = await pool.query<{ concept_id: string }>(
    `
    SELECT concept_id::text AS concept_id
    FROM concepts
    WHERE domain = $1 AND slug = $2
    LIMIT 2
    `,
    [domain, normalizedSlug]
  );

  if (r.rows.length > 1) {
    throw new Error(
      `INVARIANT_VIOLATION: concepts deveria ter no máximo 1 linha para (domain=${domain}, slug=${normalizedSlug}); ` +
        `encontradas ${r.rows.length}. Corrupção de dados ou schema.`
    );
  }

  if (r.rows.length === 0) {
    return {
      status: 'unresolved',
      slug: normalizedSlug,
      domain,
      reason: 'not_found',
    };
  }

  return {
    status: 'resolved',
    conceptId: r.rows[0]!.concept_id,
    domain,
    slug: normalizedSlug,
  };
}

export function isResolvedConceptSlug(r: ConceptSlugResolveResult): r is Extract<ConceptSlugResolveResult, { status: 'resolved' }> {
  return r.status === 'resolved';
}