/**
 * ⚠️ NÃO É MOTOR DE CONCEITO
 *
 * Este módulo NÃO define conceitos canónicos nem faz INSERT em `concepts`
 * nem enfileira diretamente em `canonical_concept_resolution_queue`.
 *
 * // TODO: encaminhar para canonical_concept_resolution_queue via fluxo existente
 * quando `conceptNeedsResolution === true` (camada superior: canónico / backoffice).
 */

import { normalizeConceptSlug } from '@core/ontology/concept-governance.service';

import { resolveConceptSlug } from './concept-slug-resolve.service';
import { getDefaultConceptDomain } from './concept-resolution-context';
import type {
  ResolvedEntityType,
  ResolvedQuery,
  ResolvedQueryLocation,
  ResolvedQueryTime,
  ResolveQueryOptions,
} from './concept-resolution.types';

const REASONABLE_YEAR_MIN = 1800;
const REASONABLE_YEAR_MAX = 2100;

const VEHICLE_CLASS_WORDS = new Set([
  'carro',
  'carros',
  'moto',
  'motos',
  'caminhao',
  'caminhão',
  'van',
  'pickup',
  'utilitario',
  'utilitário',
]);

const BRAND_DISPLAY: Record<string, string> = {
  fiat: 'Fiat',
  volkswagen: 'Volkswagen',
  vw: 'Volkswagen',
  ford: 'Ford',
  chevrolet: 'Chevrolet',
  gm: 'Chevrolet',
  toyota: 'Toyota',
  honda: 'Honda',
  hyundai: 'Hyundai',
  renault: 'Renault',
  peugeot: 'Peugeot',
  citroen: 'Citroën',
  nissan: 'Nissan',
  bmw: 'BMW',
  mercedes: 'Mercedes-Benz',
  audi: 'Audi',
  jeep: 'Jeep',
};

const CITY_DISPLAY: Record<string, string> = {
  curitiba: 'Curitiba',
  'sao paulo': 'São Paulo',
  saopaulo: 'São Paulo',
  'rio de janeiro': 'Rio de Janeiro',
  rio: 'Rio de Janeiro',
  'belo horizonte': 'Belo Horizonte',
  brasilia: 'Brasília',
  salvador: 'Salvador',
  fortaleza: 'Fortaleza',
  manaus: 'Manaus',
};

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '');
}

function collapseWhitespace(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

function isFourDigitYearToken(token: string): number | undefined {
  if (!/^\d{4}$/.test(token)) return undefined;
  const n = Number.parseInt(token, 10);
  if (n < REASONABLE_YEAR_MIN || n > REASONABLE_YEAR_MAX) return undefined;
  return n;
}

function tokenKey(token: string): string {
  return stripDiacritics(token).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function tokenKeyPhrase(tokens: string[], start: number, len: number): string {
  return tokens
    .slice(start, start + len)
    .map((t) => stripDiacritics(t).toLowerCase())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchCityFromTokens(tokens: string[]): { city?: string; skipIndices: Set<number> } {
  const skip = new Set<number>();
  let city: string | undefined;

  for (let i = 0; i < tokens.length; i++) {
    const t1 = tokenKey(tokens[i]);
    if (CITY_DISPLAY[t1]) {
      city = CITY_DISPLAY[t1];
      skip.add(i);
      continue;
    }
    if (i + 1 < tokens.length) {
      const phrase2 = tokenKeyPhrase(tokens, i, 2);
      if (CITY_DISPLAY[phrase2]) {
        city = CITY_DISPLAY[phrase2];
        skip.add(i);
        skip.add(i + 1);
        i++;
        continue;
      }
      const compact2 = phrase2.replace(/\s/g, '');
      if (CITY_DISPLAY[compact2]) {
        city = CITY_DISPLAY[compact2];
        skip.add(i);
        skip.add(i + 1);
        i++;
        continue;
      }
    }
    if (i + 2 < tokens.length) {
      const phrase3 = tokenKeyPhrase(tokens, i, 3);
      if (CITY_DISPLAY[phrase3]) {
        city = CITY_DISPLAY[phrase3];
        skip.add(i);
        skip.add(i + 1);
        skip.add(i + 2);
        i += 2;
      }
    }
  }

  return { city, skipIndices: skip };
}

function inferEntityType(hasVehicleWord: boolean, hasBrand: boolean): ResolvedEntityType | undefined {
  if (hasVehicleWord || hasBrand) return 'vehicle';
  return undefined;
}

function buildConceptTextTokens(tokens: string[], skip: Set<number>): string | undefined {
  const kept = tokens.filter((_, idx) => !skip.has(idx));
  if (kept.length === 0) return undefined;
  const s = kept.join(' ').replace(/\s+/g, ' ').trim();
  return s || undefined;
}

interface ParsedSignals {
  conceptText?: string;
  entityType?: ResolvedEntityType;
  time?: ResolvedQueryTime;
  location?: ResolvedQueryLocation;
  raw: string;
}

function parseTextSignals(input: string): ParsedSignals {
  const raw = collapseWhitespace(input);
  if (!raw) {
    return { raw: '' };
  }

  const tokens = raw.split(/\s+/).filter(Boolean);
  const skipIndices = new Set<number>();
  let time: ResolvedQueryTime | undefined;
  let yearFound: number | undefined;

  for (let i = 0; i < tokens.length; i++) {
    const y = isFourDigitYearToken(tokens[i]);
    if (y !== undefined) {
      yearFound = y;
      skipIndices.add(i);
      break;
    }
  }

  if (yearFound !== undefined) {
    time = { type: 'year', value: yearFound };
  }

  const { city, skipIndices: citySkips } = matchCityFromTokens(tokens);
  citySkips.forEach((j) => skipIndices.add(j));

  let hasVehicleWord = false;
  let hasBrand = false;

  for (let i = 0; i < tokens.length; i++) {
    if (skipIndices.has(i)) continue;
    const k = tokenKey(tokens[i]);
    if (VEHICLE_CLASS_WORDS.has(k)) {
      hasVehicleWord = true;
      skipIndices.add(i);
    } else if (BRAND_DISPLAY[k]) {
      hasBrand = true;
    }
  }

  const conceptSkip = new Set(skipIndices);
  for (let i = 0; i < tokens.length; i++) {
    if (VEHICLE_CLASS_WORDS.has(tokenKey(tokens[i]))) {
      conceptSkip.add(i);
    }
  }

  const conceptText = buildConceptTextTokens(tokens, conceptSkip);
  const location = city ? { city } : undefined;
  const entityType = inferEntityType(hasVehicleWord, hasBrand);

  return {
    conceptText,
    entityType,
    time,
    location,
    raw,
  };
}

function withResolutionFlags(
  base: Omit<ResolvedQuery, 'conceptResolved' | 'conceptNeedsResolution'>
): ResolvedQuery {
  const hasConceptText = Boolean(base.conceptText && base.conceptText.trim() !== '');
  const resolved = Boolean(base.conceptId);
  return {
    ...base,
    conceptResolved: resolved,
    conceptNeedsResolution: !resolved && hasConceptText,
  };
}

/**
 * Consulta read-only: delega em `resolveConceptSlug` (domínio obrigatório explícito).
 */
export async function tryResolveConceptId(slug: string, domain: string): Promise<string | null> {
  const r = await resolveConceptSlug({ slug, domain });
  return r.status === 'resolved' ? r.conceptId : null;
}

/**
 * Parser P0 + lookup opcional em `concepts` (sem INSERT, sem canonical_products).
 */
export async function resolveQuery(
  input: string,
  options?: ResolveQueryOptions
): Promise<ResolvedQuery> {
  const parsed = parseTextSignals(input);
  const explicitDomain = options?.conceptDomain?.trim();
  const domainFromContext =
    options?.conceptResolutionContext != null
      ? getDefaultConceptDomain(options.conceptResolutionContext)
      : undefined;
  /** `conceptDomain` explícito sobrepõe o derivado do contexto. */
  const domain = (explicitDomain || domainFromContext) ?? '';

  if (!parsed.raw) {
    return withResolutionFlags({ ...parsed });
  }

  if (!parsed.conceptText || !domain) {
    return withResolutionFlags({ ...parsed });
  }

  const resolved = await resolveConceptSlug({ slug: parsed.conceptText, domain });
  const conceptSlugNorm = normalizeConceptSlug(parsed.conceptText) || undefined;
  const conceptId = resolved.status === 'resolved' ? resolved.conceptId : undefined;

  return withResolutionFlags({
    ...parsed,
    conceptSlug: conceptSlugNorm,
    conceptId,
  });
}