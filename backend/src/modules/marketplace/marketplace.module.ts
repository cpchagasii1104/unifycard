// backend/src/modules/marketplace/marketplace.module.ts
// Container de bootstrap: criação dos 10 agregadores e das instâncias de domain.
// O MarketplaceService recebe domainFactories e usa getters lazy para obter os módulos de domain.
// Regra: estado (stores/Maps) vive apenas nos domain services; a facade é stateless.

import { MarketplaceService } from './marketplace.service';
import { MarketplaceB2BService } from './domain/b2b/marketplace-b2b.service';
import { MarketplaceSubscriptionsService, type ISubscriptionOrchestrator } from './domain/subscriptions/marketplace-subscriptions.service';

export type { ISubscriptionOrchestrator };
import { MarketplaceCompensationService } from './domain/capacity/marketplace-compensation.service';
import { MarketplaceExpansionService } from './domain/capacity/marketplace-expansion.service';
import { MarketplacePaymentsService as MarketplacePaymentsDomainService } from './domain/payments/marketplace-payments.service';
import { MarketplaceDispatchPresenceService } from './domain/dispatch/marketplace-dispatch-presence.service';
import { MarketplaceServiceLifecycleService } from './domain/services/marketplace-service-lifecycle.service';
import { MarketplaceProductionModule } from './domain/production/marketplace-production.service';
import { MarketplaceOfferingsModule } from './domain/offerings/marketplace-offerings.service';
import { MarketplaceSlaModule } from './domain/sla/marketplace-sla.service';
import { MarketplaceIndustryModule } from './domain/industry/marketplace-industry.service';
import { MarketplaceEconomicModule } from './domain/economic/marketplace-economic.service';
import { MarketplaceCompanyModule } from './domain/company/marketplace-company.service';
import { MarketplaceCapacityModule } from './domain/capacity/marketplace-capacity.service';
import { MarketplaceDispatchModule } from './domain/dispatch/marketplace-dispatch.service';
import { MarketplaceOrdersModule } from './domain/orders/marketplace-orders.service';
import { MarketplaceOrdersService } from './services/marketplace-orders.service';
import { MarketplaceCheckoutService } from './services/marketplace-checkout.service';
import {
  MarketplacePaymentsService,
  type IPaymentsDomainTerminalStore,
} from './services/marketplace-payments.service';
import {
  MarketplaceDispatchAggregatorService,
  type IDispatchAggregatorDeps,
} from './services/marketplace-dispatch.service';
import { MarketplaceServicesAggregatorService } from './services/marketplace-services.service';
import { MarketplaceCatalogAggregatorService } from './services/marketplace-catalog.service';
import { MarketplaceCompanyAggregatorService } from './services/marketplace-company.service';
import { MarketplaceCapacityAggregatorService, type ICompensationDomain } from './services/marketplace-capacity.service';
import { MarketplaceDiscoveryAggregatorService } from './services/marketplace-discovery.service';
import { MarketplaceGovernanceAggregatorService } from './services/marketplace-governance.service';
import type { CompanyApplicationService } from './application/services/company-application.service';
import type { CapacityApplicationService } from './application/services/capacity-application.service';
import type { RegionalCapacityApplicationService } from './application/services/regional-capacity-application.service';
import type { PaymentsApplicationService } from './application/services/payments-application.service';
import type { MarketplaceOrchestrationService } from './application/services/marketplace-orchestration.service';
import type { CatalogApplicationService } from './application/services/catalog-application.service';
import type { DiscoveryApplicationService } from './application/services/discovery-application.service';
import type { OrdersApplicationService } from './application/services/orders-application.service';
import type { CommerceOperationsApplicationService } from './application/services/commerce-operations-application.service';
import type { OfferingsApplicationService } from './application/services/offerings-application.service';
import type { MarketplaceServicesModule } from './marketplace-services.service';
import type { MarketplacePaymentsService as PaymentsDomainService } from './domain/payments/marketplace-payments.service';

export type { IPaymentsDomainTerminalStore };

export interface IMarketplaceDomainFactories {
  createB2BService: (facade: MarketplaceService) => MarketplaceB2BService;
  createSubscriptionsService: (facade: MarketplaceService) => MarketplaceSubscriptionsService;
  createCompensationService: (facade: MarketplaceService) => MarketplaceCompensationService;
  createExpansionService: (facade: MarketplaceService) => MarketplaceExpansionService;
  createPaymentsDomainService: (facade: MarketplaceService) => MarketplacePaymentsDomainService;
  createDispatchPresenceService: (facade: MarketplaceService) => MarketplaceDispatchPresenceService;
  createServiceLifecycleService: (facade: MarketplaceService) => MarketplaceServiceLifecycleService;
  createProductionModule: (facade: MarketplaceService) => MarketplaceProductionModule;
  createOfferingsModule: (facade: MarketplaceService) => MarketplaceOfferingsModule;
  createSlaModule: (facade: MarketplaceService) => MarketplaceSlaModule;
  createIndustryModule: (facade: MarketplaceService) => MarketplaceIndustryModule;
  createEconomicModule: (facade: MarketplaceService) => MarketplaceEconomicModule;
  createCompanyModule: (facade: MarketplaceService) => MarketplaceCompanyModule;
  createCapacityModule: (facade: MarketplaceService) => MarketplaceCapacityModule;
  createDispatchModule: (facade: MarketplaceService) => MarketplaceDispatchModule;
  createOrdersModule: (facade: MarketplaceService) => MarketplaceOrdersModule;
}

export interface IMarketplaceAggregatorDeps {
  ordersApplicationService: OrdersApplicationService;
  commerceOperationsApplicationService: CommerceOperationsApplicationService;
  paymentsApplicationService: PaymentsApplicationService;
  catalogApplicationService: CatalogApplicationService;
  marketplaceOrchestrationService: MarketplaceOrchestrationService;
  companyApplicationService: CompanyApplicationService;
  capacityApplicationService: CapacityApplicationService;
  regionalCapacityApplicationService: RegionalCapacityApplicationService;
  compensationDomain: ICompensationDomain;
  discoveryApplicationService: DiscoveryApplicationService;
  offeringsApplicationService: OfferingsApplicationService;
  servicesModule: MarketplaceServicesModule;
  serviceLifecycleDomain: MarketplaceServiceLifecycleService;
  slaModule: { getDisputeCasesMap(): Map<string, unknown> };
  complianceModule: unknown;
  getDispatchAggregatorDeps: () => IDispatchAggregatorDeps;
  paymentsDomain: PaymentsDomainService;
}

export interface IMarketplaceAggregators {
  orders: MarketplaceOrdersService;
  checkout: MarketplaceCheckoutService;
  payments: MarketplacePaymentsService;
  dispatch: MarketplaceDispatchAggregatorService;
  services: MarketplaceServicesAggregatorService;
  catalog: MarketplaceCatalogAggregatorService;
  company: MarketplaceCompanyAggregatorService;
  capacity: MarketplaceCapacityAggregatorService;
  discovery: MarketplaceDiscoveryAggregatorService;
  governance: MarketplaceGovernanceAggregatorService;
}

/**
 * Cria os 10 agregadores a partir dos application services e módulos já inicializados.
 * O facade chama esta função após criar company, capacity, regional capacity e payments application services.
 */
export function createMarketplaceAggregators(deps: IMarketplaceAggregatorDeps): IMarketplaceAggregators {
  return {
    orders: new MarketplaceOrdersService(deps.ordersApplicationService, deps.commerceOperationsApplicationService),
    checkout: new MarketplaceCheckoutService(deps.ordersApplicationService, deps.commerceOperationsApplicationService),
    payments: new MarketplacePaymentsService(
      deps.paymentsApplicationService,
      deps.commerceOperationsApplicationService,
      deps.paymentsDomain
    ),
    dispatch: new MarketplaceDispatchAggregatorService(deps.getDispatchAggregatorDeps()),
    services: new MarketplaceServicesAggregatorService(
      deps.offeringsApplicationService,
      deps.ordersApplicationService,
      deps.servicesModule,
      deps.serviceLifecycleDomain
    ),
    catalog: new MarketplaceCatalogAggregatorService(deps.catalogApplicationService, deps.marketplaceOrchestrationService),
    company: new MarketplaceCompanyAggregatorService(deps.companyApplicationService, deps.marketplaceOrchestrationService),
    capacity: new MarketplaceCapacityAggregatorService(deps.capacityApplicationService, deps.regionalCapacityApplicationService, deps.compensationDomain),
    discovery: new MarketplaceDiscoveryAggregatorService(deps.discoveryApplicationService),
    governance: new MarketplaceGovernanceAggregatorService(deps.slaModule as any),
  };
}

/**
 * Cria a instância do MarketplaceService (facade) com fábricas de domain injetadas.
 * Todas as instâncias de domain passam a ser criadas aqui; a facade não importa ./domain/.
 */
export function createMarketplaceService(): MarketplaceService {
  const domainFactories: IMarketplaceDomainFactories = {
    createB2BService: (facade) => new MarketplaceB2BService(facade),
    createSubscriptionsService: (facade) => new MarketplaceSubscriptionsService(facade.getSubscriptionOrchestratorAdapter()),
    createCompensationService: (facade) => new MarketplaceCompensationService(facade),
    createExpansionService: (facade) => new MarketplaceExpansionService(facade),
    createPaymentsDomainService: (facade) => new MarketplacePaymentsDomainService(facade),
    createDispatchPresenceService: (facade) => new MarketplaceDispatchPresenceService(facade),
    createServiceLifecycleService: (facade) => new MarketplaceServiceLifecycleService(facade),
    createProductionModule: (facade) => new MarketplaceProductionModule(facade),
    createOfferingsModule: (facade) => new MarketplaceOfferingsModule(facade),
    createSlaModule: (facade) => new MarketplaceSlaModule(facade),
    createIndustryModule: (facade) => new MarketplaceIndustryModule(facade),
    createEconomicModule: (facade) => new MarketplaceEconomicModule(facade),
    createCompanyModule: (facade) => new MarketplaceCompanyModule(facade, facade.stateAdapter),
    createCapacityModule: (facade) => new MarketplaceCapacityModule(facade),
    createDispatchModule: (facade) => new MarketplaceDispatchModule(facade, facade.eventBus, facade.stateAdapter),
    createOrdersModule: (facade) => new MarketplaceOrdersModule(facade, facade.stateAdapter),
  };
  return new MarketplaceService({ domainFactories });
}