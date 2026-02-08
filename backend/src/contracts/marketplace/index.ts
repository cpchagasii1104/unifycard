// backend/src/contracts/marketplace/index.ts
// CONTRATOS PÚBLICOS DO MARKETPLACE - Barrel Export
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA

export type { Order } from './Order.contract';
export type { CheckoutIntent } from './CheckoutIntent.contract';
export type { PaymentPlan } from './PaymentPlan.contract';
export type { DeliveryOrder } from './DeliveryOrder.contract';
export type { ServiceOrder } from './ServiceOrder.contract';
export type { Subscription, SubscriptionCycle } from './Subscription.contract';
export type { IndustryAccount } from './IndustryAccount.contract';
export type { DistributionHub } from './DistributionHub.contract';
export type { SLAContract } from './SLAContract.contract';
export type { ReputationSnapshot } from './ReputationSnapshot.contract';
export type { DisputeCase } from './DisputeCase.contract';
export type { EconomicIdentity } from './EconomicIdentity.contract';
export type { TrustEvent } from './TrustEvent.contract';
export type { RegionalFund } from './RegionalFund.contract';
export type { RegionalFundAllocation } from './RegionalFundAllocation.contract';
export type { EconomicEvent } from './EconomicEvent.contract';
export type { RegionalImpactMetrics } from './RegionalImpactMetrics.contract';
export type { RegionalActivationRule } from './RegionalActivationRule.contract';
export type { ActivationEvent } from './ActivationEvent.contract';
export type { IncentiveRule } from './IncentiveRule.contract';
export type { IncentiveGrant } from './IncentiveGrant.contract';
export type { B2BCommercialContract } from './B2BCommercialContract.contract';
export type { B2BContractExecution } from './B2BContractExecution.contract';
export type { EconomicSustainabilitySnapshot } from './EconomicSustainabilitySnapshot.contract';
export type { ProductionBatch } from './ProductionBatch.contract';
export type { BatchCommitment } from './BatchCommitment.contract';
export type { CompanyOnboarding } from './CompanyOnboarding.contract';
export type { PaymentTerminal } from './PaymentTerminal.contract';
export type { CompanyPlan } from './CompanyPlan.contract';
export type { PaymentInfrastructureConfig } from './PaymentInfrastructureConfig.contract';
export type { RevenueSnapshot, RevenueSource } from './RevenueSnapshot.contract';
export type { RegionalFinancialFlow } from './RegionalFinancialFlow.contract';
export type { ServiceRequest } from './ServiceRequest.contract';
export type { ServiceDispatch } from './ServiceDispatch.contract';
export type { ProviderPresence } from './ProviderPresence.contract';
export type { ServicePreReservation } from './ServicePreReservation.contract';
export type { ServicePaymentHold } from './ServicePaymentHold.contract';
export type { ServiceCompletionSignal } from './ServiceCompletionSignal.contract';
export type { ServiceVisit } from './ServiceVisit.contract';
export type { ServiceQuote } from './ServiceQuote.contract';
export type { ServiceGovernanceMetrics } from './ServiceGovernanceMetrics.contract';
export type { BusinessTemplate } from './BusinessTemplate.contract';
export type { ActorRole } from './ActorRole.contract';
export type { CompanyCollaborator } from './CompanyCollaborator.contract';
export type { PluginDefinition, PluginExecution, PluginCategory, PluginHook } from './PluginDefinition.contract';
export type { ServiceEvaluation, EvaluationAggregate } from './ServiceEvaluation.contract';
export type { ProductTemplate, ProductTemplateType } from './ProductTemplate.contract';
export type { ServiceTemplateCanonical } from './ServiceTemplateCanonical.contract';
export type {
  ServiceResource,
  ServiceResourceType,
  ServiceResourceStatus,
  ServiceResourceDependency,
  CompanyCapacityMetrics,
} from './ServiceResource.contract';
export type {
  ResourceCapacityMetrics,
  CapacityEvent,
  CapacitySnapshot,
} from './CapacityMetrics.contract';
export type {
  CompensationModel,
  ResourceCompensationConfig,
  ResourceCompensation,
  ResourceCompensationHistory,
  CompanyCompensationReport,
} from './ResourceCompensation.contract';
export type {
  VoucherOffer,
  VoucherType,
  VoucherVisibilityScope,
  VoucherOfferStatus,
} from './VoucherOffer.contract';
export type {
  VoucherClaim,
  VoucherClaimStatus,
} from './VoucherClaim.contract';
export type {
  VoucherRedemptionEvent,
  VoucherEventType,
} from './VoucherRedemptionEvent.contract';
export type {
  RegionalCapacitySnapshot,
  RegionalCapacityMetric,
  RegionalCapacityStatus,
  BottleneckCause,
  SLARiskLevel,
} from './RegionalCapacitySnapshot.contract';
export type {
  RegionalExpansionSignal,
  ExpansionSignalType,
  ExpansionUnlockFeature,
  ExpansionUnlock,
} from './RegionalExpansionSignal.contract';
export type {
  PricingAssistanceReport,
  BreakEvenAnalysis,
  ServiceMarginAnalysis,
  OperationalCostProfile,
  RealOperationMetrics,
  OperationalRiskLevel,
} from './PricingAssistanceReport.contract';

