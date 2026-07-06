/**
 * Reference vocabulary — valores canônicos compartilhados entre frontend e backend.
 * §SSOT: fonte única de verdade para enumerações de domínio (§5.16 SSOT_REGISTRY_UNIFICARD).
 */

// Gender — vocabulário soberano de 5 valores. Fonte soberana: DECISION-0115 D3 (ratificada por
// Clayton), que supera a DECISION-0080 §4 exclusivamente no enum; a macrofrente C1 implementou.
// Casa canônica: global_users.gender (set-once).
export const GENDER_VALUES = ['male', 'female', 'non_binary', 'other', 'prefer_not_to_say'] as const;
export type Gender = typeof GENDER_VALUES[number];
export function isGender(value: unknown): value is Gender {
  return GENDER_VALUES.includes(value as Gender);
}

// Language
export const LANGUAGE_VALUES = ['pt', 'en', 'es'] as const;
export type LanguageCode = typeof LANGUAGE_VALUES[number];

// Country
export const COUNTRY_VALUES = ['BR', 'US', 'AR', 'UY', 'PY', 'CL', 'CO', 'MX', 'PT'] as const;
export type CountryCode = typeof COUNTRY_VALUES[number];

// Currency
export const CURRENCY_VALUES = ['BRL', 'USD', 'EUR', 'ARS', 'CLP', 'COP', 'MXN', 'PYG', 'UYU'] as const;
export type CurrencyCode = typeof CURRENCY_VALUES[number];

// MarketplaceDomain — rótulos de navegação/UX do marketplace (DECISION-0106: NÃO é SSOT semântico —
// identidade é CONCEPT; o mapa rótulo→N0 vive em backend/src/core/marketplace-domain, D1-D6).
// Casa canônica do VOCABULÁRIO compartilhado frontend+backend (fecha o fork: 2 cópias frontend +
// 4 backend convergidas — guard audit-governed-vocabulary-manifest).
export const MARKETPLACE_DOMAIN_VALUES = ['market', 'services', 'events', 'real_estate', 'vehicles', 'jobs'] as const;
export type MarketplaceDomain = typeof MARKETPLACE_DOMAIN_VALUES[number];
export function isMarketplaceDomain(value: unknown): value is MarketplaceDomain {
  return MARKETPLACE_DOMAIN_VALUES.includes(value as MarketplaceDomain);
}

// Timezone
export const TIMEZONE_VALUES = [
  'America/Sao_Paulo',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Buenos_Aires',
  'America/Montevideo',
  'America/Asuncion',
  'America/Santiago',
  'America/Bogota',
  'America/Mexico_City',
  'Europe/Lisbon',
  'UTC',
] as const;
export type TimezoneId = typeof TIMEZONE_VALUES[number];
