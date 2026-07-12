/**
 * Reference vocabulary — valores canônicos compartilhados entre frontend e backend.
 * §SSOT: fonte única de verdade para enumerações de domínio (§5.16 SSOT_REGISTRY_UNIFICARD).
 */
export declare const GENDER_VALUES: readonly ["male", "female", "non_binary", "other", "prefer_not_to_say"];
export type Gender = typeof GENDER_VALUES[number];
export declare function isGender(value: unknown): value is Gender;
export declare const LANGUAGE_VALUES: readonly ["pt", "en", "es"];
export type LanguageCode = typeof LANGUAGE_VALUES[number];
export declare const COUNTRY_VALUES: readonly ["BR", "US", "AR", "UY", "PY", "CL", "CO", "MX", "PT"];
export type CountryCode = typeof COUNTRY_VALUES[number];
export declare const CURRENCY_VALUES: readonly ["BRL", "USD", "EUR", "ARS", "CLP", "COP", "MXN", "PYG", "UYU"];
export type CurrencyCode = typeof CURRENCY_VALUES[number];
export declare const MARKETPLACE_DOMAIN_VALUES: readonly ["market", "services", "events", "real_estate", "vehicles", "jobs"];
export type MarketplaceDomain = typeof MARKETPLACE_DOMAIN_VALUES[number];
export declare function isMarketplaceDomain(value: unknown): value is MarketplaceDomain;
export declare const TIMEZONE_VALUES: readonly ["America/Sao_Paulo", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Buenos_Aires", "America/Montevideo", "America/Asuncion", "America/Santiago", "America/Bogota", "America/Mexico_City", "Europe/Lisbon", "UTC"];
export type TimezoneId = typeof TIMEZONE_VALUES[number];
//# sourceMappingURL=vocabulary.d.ts.map