/**
 * C66: Resolver concept_id financeiro a partir de slug ou UUID.
 *
 * - UUID valido: passa direto sem query.
 * - Slug: tenta resolver em cada um dos 7 dominios financeiros via resolveConceptSlug.
 * - Fail-closed: throw INVALID_CONCEPT_ID se 0 ou >1 match.
 * - Cache em memoria preserva (conceptId, domain) — nao apenas conceptId — para evitar
 *   cache semanticamente cego se slug duplicar em outro dominio futuramente.
 *
 * Uso pelo bank-transaction.service para aceitar callers legados que passam
 * slug literal (ex.: 'split-payment') ate Frente 3 migrar todos para UUID.
 */
import { resolveConceptSlug, isResolvedConceptSlug } from './concept-slug-resolve.service';

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

interface CachedResolution {
  conceptId: string;
  domain: string;
}

const slugCache = new Map<string, CachedResolution>();

export function isUuidShape(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Resolve concept_id (UUID) a partir de slug ou UUID financeiro.
 * Fail-closed: throw em caso de 0 ou multiplos matches.
 */
export async function resolveFinancialConceptId(slugOrUuid: string): Promise<string> {
  if (!slugOrUuid || typeof slugOrUuid !== 'string') {
    throw new Error('INVALID_CONCEPT_ID: concept_id vazio ou nao-string');
  }
  if (isUuidShape(slugOrUuid)) {
    return slugOrUuid;
  }
  const cached = slugCache.get(slugOrUuid);
  if (cached) {
    return cached.conceptId;
  }
  const matches: CachedResolution[] = [];
  for (const domain of FINANCIAL_DOMAINS) {
    const r = await resolveConceptSlug({ slug: slugOrUuid, domain });
    if (isResolvedConceptSlug(r)) {
      matches.push({ conceptId: r.conceptId, domain });
    }
  }
  if (matches.length === 0) {
    throw new Error(`INVALID_CONCEPT_ID: slug '${slugOrUuid}' nao encontrado nos dominios financeiros`);
  }
  if (matches.length > 1) {
    const domains = matches.map(m => m.domain).join(', ');
    throw new Error(`INVALID_CONCEPT_ID: slug '${slugOrUuid}' ambiguo entre dominios [${domains}]`);
  }
  const resolution = matches[0]!;
  slugCache.set(slugOrUuid, resolution);
  return resolution.conceptId;
}

/** Limpa cache. Util para testes. */
export function clearFinancialConceptResolverCache(): void {
  slugCache.clear();
}