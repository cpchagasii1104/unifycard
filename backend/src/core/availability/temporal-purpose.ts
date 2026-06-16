// src/core/availability/temporal-purpose.ts
// DECISION-0132: finalidade temporal da agenda pessoal = CONCEPT.
//
// 🔴 SSOT da identidade da finalidade = `concepts` (concept_id) + `availability.purpose_concept_id`.
//    Este módulo NÃO é a verdade persistida: é o RESOLVER server-side (slug declarado → concept_id
//    canônico) + a POLÍTICA de bookability derivada da finalidade (§4 da DECISION). Slug vindo do
//    cliente é APENAS declaração; quem decide é o concept_id resolvido por (domain, slug) canônico.
//
// SEM novo domínio N0 (18_DOMAIN_ONTOLOGY §7 lista fechada). Os 4 concepts moram em domínios N0
// NATURAIS; o domínio NÃO é limite de matching (ADENDO Clayton).

import { pool } from '../database/pool';

/** Par canônico (slug → domínio N0 natural) das 4 finalidades temporais. DECISION-0132 §3. */
export const TEMPORAL_PURPOSE_DOMAIN_BY_SLUG: Record<string, string> = {
  'trabalho': 'servicos',
  'estudo': 'educacao-e-conhecimento',
  'cuidados-pessoais': 'saude-e-bem-estar',
  'lazer': 'cultura-lazer-e-eventos',
};

export const TEMPORAL_PURPOSE_SLUGS: string[] = Object.keys(TEMPORAL_PURPOSE_DOMAIN_BY_SLUG);

/** Política de bookability (DECISION-0132 §4): só `trabalho` é bookável; demais = protegidos. */
export const BOOKABLE_TEMPORAL_PURPOSE_SLUGS: ReadonlySet<string> = new Set(['trabalho']);

export function isTemporalPurposeSlug(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(TEMPORAL_PURPOSE_DOMAIN_BY_SLUG, slug);
}

// `concepts` é global (sem tenant_id) e imutável após seed → cache em processo, mas SÓ quando completo
// (evita cache vazio antes do seed, ex.: em DB efêmera de e2e).
let _bySlug: Map<string, string> | null = null;
let _slugById: Map<string, string> | null = null;

async function load(): Promise<{ bySlug: Map<string, string>; slugById: Map<string, string> }> {
  if (_bySlug && _slugById && _bySlug.size === TEMPORAL_PURPOSE_SLUGS.length) {
    return { bySlug: _bySlug, slugById: _slugById };
  }
  const bySlug = new Map<string, string>();
  const slugById = new Map<string, string>();
  for (const [slug, domain] of Object.entries(TEMPORAL_PURPOSE_DOMAIN_BY_SLUG)) {
    const r = await pool.query<{ concept_id: string }>(
      `SELECT concept_id FROM concepts WHERE domain = $1 AND slug = $2 LIMIT 1`,
      [domain, slug]
    );
    const id = r.rows[0]?.concept_id;
    if (id) {
      bySlug.set(slug, id);
      slugById.set(id, slug);
    }
  }
  if (bySlug.size === TEMPORAL_PURPOSE_SLUGS.length) {
    _bySlug = bySlug;
    _slugById = slugById;
  }
  return { bySlug, slugById };
}

/** Resolve um slug de finalidade → concept_id canônico (ou null se inválido/não-semeado). */
export async function resolveTemporalPurposeConceptId(slug: string): Promise<string | null> {
  if (!isTemporalPurposeSlug(slug)) return null;
  const { bySlug } = await load();
  return bySlug.get(slug) ?? null;
}

/** Map slug → concept_id de todas as finalidades resolvidas. */
export async function resolveTemporalPurposeBySlug(): Promise<Map<string, string>> {
  const { bySlug } = await load();
  return new Map(bySlug);
}

/** Map concept_id → slug (para read-back / response shaping). */
export async function resolveTemporalPurposeSlugById(): Promise<Map<string, string>> {
  const { slugById } = await load();
  return new Map(slugById);
}

/**
 * Conjunto de concept_ids PROTEGIDOS (não-bookáveis): estudo/cuidados-pessoais/lazer.
 * Usado pelo gate de booking (DECISION-0132 §4). Resolvido server-side por (domain, slug) — nunca
 * compara string crua da UI.
 */
export async function getProtectedPurposeConceptIds(): Promise<Set<string>> {
  const { bySlug } = await load();
  const protectedIds = new Set<string>();
  for (const [slug, conceptId] of bySlug) {
    if (!BOOKABLE_TEMPORAL_PURPOSE_SLUGS.has(slug)) protectedIds.add(conceptId);
  }
  return protectedIds;
}

/** Lista canônica das 4 finalidades (slug + concept_id + bookable) — para o frontend resolver do backend. */
export async function listTemporalPurposes(): Promise<
  Array<{ slug: string; conceptId: string; bookable: boolean }>
> {
  const { bySlug } = await load();
  return TEMPORAL_PURPOSE_SLUGS.filter((slug) => bySlug.has(slug)).map((slug) => ({
    slug,
    conceptId: bySlug.get(slug)!,
    bookable: BOOKABLE_TEMPORAL_PURPOSE_SLUGS.has(slug),
  }));
}
