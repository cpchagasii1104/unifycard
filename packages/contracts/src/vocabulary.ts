/**
 * Reference vocabulary — valores canônicos compartilhados entre frontend e backend.
 * §SSOT: fonte única de verdade para enumerações de domínio (§5.16 SSOT_REGISTRY_UNIFICARD).
 */

// Gender — vocabulário soberano de 5 valores (GO F-C1-HUMAN-JOURNEY-END-TO-END-CLOSURE 2026-06-11;
// expande a DECISION-0080 que promulgara 3). Casa canônica: global_users.gender (set-once).
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
