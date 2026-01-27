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
//# sourceMappingURL=index.d.ts.map