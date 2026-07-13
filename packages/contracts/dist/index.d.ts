/**
 * @unificard/contracts
 *
 * Contratos de domínio compartilhados entre frontend e backend.
 * Fonte única de verdade para tipos que cruzam camadas.
 *
 * REGRA DE OURO:
 * - Se um tipo cruza frontend ↔ backend, ele nasce aqui ou não nasce.
 * - Backend e frontend NUNCA redefinem tipos de domínio.
 */
export type { CategoryContext, CategoryStatus, } from './categories';
export type { CompanyStatus, CompanyOperationalStatus, CompanyUserRole, } from './company';
export type { CheckoutContext, CheckoutRequest, CheckoutResult, CheckoutEventTicketInput, } from './checkout';
export type { EventStatus, EventType, } from './events';
export type { FeedItemType, FeedItem, FeedEvent, FeedResponse, } from './feed';
export type { Order, CheckoutIntent, PaymentPlan, DeliveryOrder, ServiceOrder, } from './marketplace';
export type { TerritorialNeighborhoodStatus, TerritorialAddressPurpose, PostalAddressPreview, SetTerritorialAddressCommand, TerritorialAddressWriteResult, TerritorialAddressCurrent, TerritorialAddressErrorCode, TerritorialAddressErrorBody, } from './territorial-address';
export { TERRITORIAL_ADDRESS_ERROR_CODES } from './territorial-address';
export { GENDER_VALUES, type Gender, isGender, LANGUAGE_VALUES, type LanguageCode, COUNTRY_VALUES, type CountryCode, CURRENCY_VALUES, type CurrencyCode, TIMEZONE_VALUES, type TimezoneId, MARKETPLACE_DOMAIN_VALUES, type MarketplaceDomain, isMarketplaceDomain, } from './vocabulary';
//# sourceMappingURL=index.d.ts.map