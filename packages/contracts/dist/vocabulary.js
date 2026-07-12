"use strict";
/**
 * Reference vocabulary — valores canônicos compartilhados entre frontend e backend.
 * §SSOT: fonte única de verdade para enumerações de domínio (§5.16 SSOT_REGISTRY_UNIFICARD).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIMEZONE_VALUES = exports.MARKETPLACE_DOMAIN_VALUES = exports.CURRENCY_VALUES = exports.COUNTRY_VALUES = exports.LANGUAGE_VALUES = exports.GENDER_VALUES = void 0;
exports.isGender = isGender;
exports.isMarketplaceDomain = isMarketplaceDomain;
// Gender — vocabulário soberano de 5 valores. Fonte soberana: DECISION-0115 D3 (ratificada por
// Clayton), que supera a DECISION-0080 §4 exclusivamente no enum; a macrofrente C1 implementou.
// Casa canônica: global_users.gender (set-once).
exports.GENDER_VALUES = ['male', 'female', 'non_binary', 'other', 'prefer_not_to_say'];
function isGender(value) {
    return exports.GENDER_VALUES.includes(value);
}
// Language
exports.LANGUAGE_VALUES = ['pt', 'en', 'es'];
// Country
exports.COUNTRY_VALUES = ['BR', 'US', 'AR', 'UY', 'PY', 'CL', 'CO', 'MX', 'PT'];
// Currency
exports.CURRENCY_VALUES = ['BRL', 'USD', 'EUR', 'ARS', 'CLP', 'COP', 'MXN', 'PYG', 'UYU'];
// MarketplaceDomain — rótulos de navegação/UX do marketplace (DECISION-0106: NÃO é SSOT semântico —
// identidade é CONCEPT; o mapa rótulo→N0 vive em backend/src/core/marketplace-domain, D1-D6).
// Casa canônica do VOCABULÁRIO compartilhado frontend+backend (fecha o fork: 2 cópias frontend +
// 4 backend convergidas — guard audit-governed-vocabulary-manifest).
exports.MARKETPLACE_DOMAIN_VALUES = ['market', 'services', 'events', 'real_estate', 'vehicles', 'jobs'];
function isMarketplaceDomain(value) {
    return exports.MARKETPLACE_DOMAIN_VALUES.includes(value);
}
// Timezone
exports.TIMEZONE_VALUES = [
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
];
