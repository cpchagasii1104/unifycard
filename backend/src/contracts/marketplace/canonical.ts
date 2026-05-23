/**
 * Barrel **canónico** (07_NOMENCLATURA_CANONICA): primitivos blindados, helpers e contratos **v2** apenas.
 *
 * Código novo deve importar daqui em preferência a `./index` (que ainda expõe v1 congelado).
 */
export type {
  Iso4217CurrencyCode,
  RateBps,
  MoneyAmountCents,
  CanonicalMonetaryOrRate,
  AsRateBpsOptions,
  MoneyCents,
  PositiveMoneyCents,
} from './_canonical/money.types';

export {
  asIso4217CurrencyCode,
  parseIso4217FromUnknown,
  asMoneyAmountCents,
  parseMoneyAmountFromUnknown,
  asRateBps,
  parseRateBpsFromUnknown,
  moneyBranch,
  rateBranch,
  toMoneyCents,
  asMoneyCents,
  toPositiveMoneyCents,
  toNonNegativeMoneyCents,
} from './_canonical/money.types';

export type { RegionalActivationRuleV2 } from './RegionalActivationRule.v2.contract';
export type { B2BCommercialContractV2 } from './B2BCommercialContract.v2.contract';
export type { RegionalImpactMetricsV2 } from './RegionalImpactMetrics.v2.contract';
export type { CheckoutIntentV2 } from './CheckoutIntent.v2.contract';
export type {
  SLAContractV2,
  SlaPenaltyV2,
  SlaPenaltyRedirect,
} from './SLAContract.v2.contract';
export type { EconomicEventV2, EconomicEventTypeV2 } from './EconomicEvent.v2.contract';

/** Mappers v1 → v2 (única camada que conhece ambos os shapes). */
export { regionalImpactMetricsV1ToV2 } from './mappers/regional-impact-metrics.v1-to-v2';
export { b2bCommercialContractV1ToV2 } from './mappers/b2b-commercial-contract.v1-to-v2';
export { regionalActivationRuleV1ToV2 } from './mappers/regional-activation-rule.v1-to-v2';