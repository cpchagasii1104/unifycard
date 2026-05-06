// ============================================================
// C66: Resolver concept_id a partir de slug ou UUID
// ============================================================
// Aceita UUID (passa direto) ou slug (resolve via SELECT em concepts).
// Fail-closed: se nao resolver, throw INVALID_CONCEPT_ID.
// Cache em memoria para reduzir round-trips.
// ============================================================

import { pool } from '@core/database/pool';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FINANCIAL_DOMAINS = [
  'financeiro-payment',
  'financeiro-escrow',
  'financeiro-payout',
  'financeiro-treasury',
  'financeiro-reversal',
  'financeiro-fund',
  'financeiro-gateway',
] as const;

const slugCache = new Map<string, string>();

export function isUuidShape(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Resolve concept_id (UUID) a partir de slug ou UUID.
 * - UUID valido: passa direto sem query
 * - Slug: busca em concepts.slug dentro dos dominios financeiros
 * - Fail-closed: throw se nao resolver ou se mais de 1 match
 */
export async function resolveConceptId(slugOrUuid: string): Promise<string> {
  if (!slugOrUuid || typeof slugOrUuid !== 'string') {
    throw new Error('INVALID_CONCEPT_ID: concept_id vazio ou nao-string');
  }
  if (isUuidShape(slugOrUuid)) {
    return slugOrUuid;
  }
  const cached = slugCache.get(slugOrUuid);
  if (cached) {
    return cached;
  }
  const result = await pool.query<{ concept_id: string; domain: string }>(
    `SELECT concept_id, domain FROM concepts WHERE slug = $1 AND domain = ANY($2::text[])`,
    [slugOrUuid, FINANCIAL_DOMAINS]
  );
  if (result.rows.length === 0) {
    throw new Error(`INVALID_CONCEPT_ID: slug '${slugOrUuid}' nao encontrado nos dominios financeiros`);
  }
  if (result.rows.length > 1) {
    const domains = result.rows.map(r => r.domain).join(', ');
    throw new Error(`INVALID_CONCEPT_ID: slug '${slugOrUuid}' ambiguo entre dominios [${domains}]`);
  }
  const conceptId = result.rows[0].concept_id;
  slugCache.set(slugOrUuid, conceptId);
  return conceptId;
}

/** Limpa cache. Util para testes. */
export function clearConceptResolverCache(): void {
  slugCache.clear();
}