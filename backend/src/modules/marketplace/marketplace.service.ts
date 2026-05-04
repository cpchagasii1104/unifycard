// backend/src/modules/marketplace/marketplace.service.ts

/**
 * MarketplaceService
 *
 * Facade stateless do módulo marketplace. Não possui estado próprio (nenhum store/Map interno).
 *
 * Responsabilidades:
 * - orquestração (bootstrap do módulo, EventBus, handlers)
 * - wiring de dependências (injeção de stores via get/set/getMap nos domain services)
 * - delegação para aggregators, application services e domain services
 *
 * Estado (stores / Maps) vive exclusivamente nos domain services.
 *
 * Arquitetura:
 *
 *   routes
 *      ↓
 *   MarketplaceService (facade)
 *      ↓
 *   services (aggregators)
 *      ↓
 *   application services
 *      ↓
 *   domain services
 *      ↓
 *   stores (Maps)
 *
 * Regra de arquitetura:
 * MarketplaceService não deve conter lógica de negócio nem estado.
 * Novas funcionalidades devem ser adicionadas em:
 * - aggregators (orders, checkout, payments, dispatch, services, catalog, company, capacity, discovery, governance)
 * - application services
 * - domain services (donos dos stores)
 */

import { marketplaceLogger } from './marketplace.logger';
import { economicIdentityService } from './economic-identity.service';
import { regionalFundService } from './regional-fund.service';
import { regionalActivationService } from './regional-activation.service';
import { storeProductService } from './store-product.service';
import type {
  Order,
  CheckoutIntent,
  PaymentPlan,
  DeliveryOrder,
  ServiceOrder,
  ServiceOffering,
  Subscription,
  SubscriptionCycle,
  IndustryAccount,
  DistributionHub,
  SLAContract,
  ReputationSnapshot,
  DisputeCase,
  EconomicIdentity,
  TrustEvent,
  RegionalFund,
  RegionalFundAllocation,
  EconomicEvent,
  RegionalImpactMetrics,
  RegionalActivationRule,
  ActivationEvent,
  IncentiveRule,
  IncentiveGrant,
  B2BCommercialContract,
  B2BContractExecution,
  EconomicSustainabilitySnapshot,
  ProductionBatch,
  BatchCommitment,
  CompanyOnboarding,
  PaymentTerminal,
  CompanyPlan,
  PaymentInfrastructureConfig,
  RevenueSnapshot,
  RevenueSource,
  RegionalFinancialFlow,
  ServiceRequest,
  ServiceDispatch,
  ProviderPresence,
  ServicePreReservation,
  ServiceBooking,
  ServicePaymentHold,
  ServiceCompletionSignal,
  ServiceVisit,
  ServiceQuote,
  ServiceGovernanceMetrics,
  BusinessTemplate,
  ActorRole,
  CompanyCollaborator,
  PluginDefinition,
  PluginExecution,
  PluginCategory,
  PluginHook,
  ServiceEvaluation,
  EvaluationAggregate,
  ProductTemplate,
  ProductTemplateType,
  ServiceTemplateCanonical,
  ServiceResource,
  ServiceResourceType,
  ServiceResourceStatus,
  ServiceResourceDependency,
  CompanyCapacityMetrics,
  ResourceCapacityMetrics,
  CapacityEvent,
  CapacitySnapshot,
  CompensationModel,
  ResourceCompensationConfig,
  ResourceCompensation,
  ResourceCompensationHistory,
  CompanyCompensationReport,
  VoucherOffer,
  VoucherType,
  VoucherVisibilityScope,
  VoucherOfferStatus,
  VoucherClaim,
  VoucherClaimStatus,
  VoucherRedemptionEvent,
  VoucherEventType,
  RegionalCapacitySnapshot,
  RegionalCapacityMetric,
  RegionalCapacityStatus,
  BottleneckCause,
  SLARiskLevel,
  RegionalExpansionSignal,
  ExpansionSignalType,
  ExpansionUnlockFeature,
  ExpansionUnlock,
  PricingAssistanceReport,
  BreakEvenAnalysis,
  ServiceMarginAnalysis,
  OperationalCostProfile,
  RealOperationMetrics,
} from '@contracts/marketplace';
import { MarketplaceVouchersService } from "./services/marketplace-vouchers.service";
import { MarketplacePricingService } from "./services/marketplace-pricing.service";
import { MarketplaceTemplatesModule } from './marketplace-templates.service';
import type { IMarketplaceDomainFactories, ISubscriptionOrchestrator } from './marketplace.module';
import { marketplaceEventBus } from './application/events/marketplace-event-bus';
import { DispatchApplicationService } from './application/services/dispatch-application.service';
import { OrdersApplicationService } from './application/services/orders-application.service';
import { CompanyApplicationService } from './application/services/company-application.service';
import { CapacityApplicationService } from './application/services/capacity-application.service';
import { RegionalCapacityApplicationService } from './application/services/regional-capacity-application.service';
import { PaymentsApplicationService } from './application/services/payments-application.service';
import { OfferingsApplicationService } from './application/services/offerings-application.service';
import { CatalogApplicationService } from './application/services/catalog-application.service';
import { DiscoveryApplicationService } from './application/services/discovery-application.service';
import { CommerceOperationsApplicationService } from './application/services/commerce-operations-application.service';
import { MarketplaceOrchestrationService } from './application/services/marketplace-orchestration.service';
import { MarketplaceServicesModule } from './marketplace-services.service';
import { MarketplaceComplianceModule } from './marketplace-compliance.service';
import { MarketplaceOrdersService } from './services/marketplace-orders.service';
import { MarketplaceCheckoutService } from './services/marketplace-checkout.service';
import { MarketplacePaymentsService } from './services/marketplace-payments.service';
import {
  MarketplaceDispatchAggregatorService,
  type IDispatchAggregatorDeps,
} from './services/marketplace-dispatch.service';
import { MarketplaceServicesAggregatorService } from './services/marketplace-services.service';
import { MarketplaceCatalogAggregatorService } from './services/marketplace-catalog.service';
import { MarketplaceCompanyAggregatorService } from './services/marketplace-company.service';
import { MarketplaceCapacityAggregatorService } from './services/marketplace-capacity.service';
import { MarketplaceDiscoveryAggregatorService } from './services/marketplace-discovery.service';
import { MarketplaceGovernanceAggregatorService } from './services/marketplace-governance.service';
import { createMarketplaceAggregators, createMarketplaceService } from './marketplace.module';
import { MarketplaceStateAdapter, type IMarketplaceStateSource } from './state/marketplace-state.adapter';
import { MarketplaceCatalogFacade } from './facades/marketplace-catalog.facade';
import { MarketplaceB2BFacade } from './facades/marketplace-b2b.facade';
import { domainEventBus, ServiceCompletedEventType } from './application/events';
import type { ServiceCompletedPayload } from './application/events';

/**
 * Perfil de custo operacional legado (actor + period).
 * Não confundir com OperationalCostProfile do contrato (store-based).
 */
interface LegacyOperationalCostProfile {
  profile_id: string;
  actorId: string;
  actorType: 'store' | 'service_provider';
  period: { year: number; month: number };
  fixed_costs: {
    rent?: number;
    utilities?: number;
    internet?: number;
    salaries?: number;
    taxes?: number;
    other?: number;
  };
  variable_costs: Array<{
    product_id?: string;
    service_id?: string;
    cost_per_unit: number;
    currency: string;
  }>;
  declared_volume_expectation?: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export class MarketplaceService {

  /* =====================================================
     APPLICATION SERVICES (orchestration — usado no bootstrap)
     ===================================================== */
  private readonly marketplaceOrchestrationService = new MarketplaceOrchestrationService();

  /* =====================================================
     AGGREGATORS (sub-facades públicas)
     Facade expõe estes serviços; call sites usam facade.orders.*, facade.checkout.*, etc.
     ===================================================== */
  readonly orders: MarketplaceOrdersService;
  readonly checkout: MarketplaceCheckoutService;
  readonly payments: MarketplacePaymentsService;
  readonly dispatch: MarketplaceDispatchAggregatorService;
  readonly services: MarketplaceServicesAggregatorService;
  readonly catalog: MarketplaceCatalogAggregatorService;
  readonly company: MarketplaceCompanyAggregatorService;
  readonly capacity: MarketplaceCapacityAggregatorService;
  readonly discovery: MarketplaceDiscoveryAggregatorService;
  readonly governance: MarketplaceGovernanceAggregatorService;
  readonly b2b: ReturnType<IMarketplaceDomainFactories['createB2BService']>;
  readonly pricing: MarketplacePricingService;

  /* =====================================================
     DOMAIN FACTORIES (injetadas pelo module; sem imports de ./domain/)
     ===================================================== */
  private readonly domainFactories: IMarketplaceDomainFactories;

  /* =====================================================
     CONSTRUCTOR / BOOTSTRAP
     Wiring: application services, stores, event handlers, aggregators.
     ===================================================== */
  constructor(deps: { domainFactories: IMarketplaceDomainFactories }) {
    this.domainFactories = deps.domainFactories;
    // ES2022: inicializadores de campo executam antes do corpo do construtor; getters que usam
    // domainFactories (offeringsModule, dispatchModule, ordersModule) e industryModule (commerce)
    // devem ser instanciados aqui, após domainFactories estar definido.
    this.offeringsApplicationService = new OfferingsApplicationService(this.offeringsModule);
    this.dispatchApplicationService = new DispatchApplicationService(this.dispatchModule, {
      getServiceOffering: (id) => this.services.getServiceOfferingInternal(id),
      getUserRequestHistory: (actorId) => this.dispatchPresence.getUserRequestHistory(actorId),
      setUserRequestHistory: (actorId, history) => this.dispatchPresence.setUserRequestHistory(actorId, history),
      generateEconomicEvent: (event) => { try { if (typeof (this as any).generateEconomicEvent === 'function') (this as any).generateEconomicEvent(event); } catch { } },
      getProviderPresence: (providerActorId) => this.dispatch.getProviderPresence(providerActorId),
      getProviderResponseSLAMetrics: (providerActorId) => this.dispatch.getProviderResponseSLAMetrics(providerActorId),
      calculateMatchingPriority: (providerActorId) => this.orchestration.calculateMatchingPriority(providerActorId),
      getServiceAvailabilities: (offeringId) => this.services.getServiceAvailability(offeringId),
      getServiceBookingsMap: () => this.serviceBookings,
      createServiceBooking: (input) => this.services.createServiceBooking(input),
      expirePreReservations: () => this.dispatch.expirePreReservations(),
    });
    this.ordersApplicationService = new OrdersApplicationService(this.ordersModule);
    this.companyApplicationService = new CompanyApplicationService(this.companyModule, {
      regionalFundService,
      economicIdentityService,
      orchestrator: {
        ...this,
        updateCompanyActivationState: (companyId: string, updates: Partial<{
          catalog_ready: boolean;
          services_ready: boolean;
          agenda_configured: boolean;
          dispatch_enabled: boolean;
          quote_flow_enabled: boolean;
          pdvEnabled: boolean;
          b2b_enabled: boolean;
        }>) => this.company.updateCompanyActivationState(companyId, updates),
      },
      terminalStore: {
        set: (id, t) => this.paymentsDomain.setPaymentTerminal(id, t),
        get: (id) => this.paymentsDomain.getPaymentTerminal(id),
        getMap: () => this.paymentsDomain.getPaymentTerminalsMap(),
      },
    });
    this.capacityApplicationService = new CapacityApplicationService(this.capacityModule, {
      get: (id) => this.compensation.getCompensation(id),
      set: (id, c) => this.compensation.setCompensation(id, c),
      getMap: () => this.compensation.getResourceCompensationsMap(),
    });
    this.regionalCapacityApplicationService = new RegionalCapacityApplicationService(this.capacityModule, {
      snapshotStore: {
        get: (id) => this.expansion.getRegionalCapacitySnapshot(id) ?? undefined,
        set: (id, v) => this.expansion.setRegionalCapacitySnapshot(id, v!),
        getMap: () => this.expansion.getRegionalCapacitySnapshotsMap(),
      },
      metricsStore: {
        get: (id) => this.expansion.getRegionalCapacityMetric(id) ?? undefined,
        set: (id, v) => this.expansion.setRegionalCapacityMetric(id, v!),
        getMap: () => this.expansion.getRegionalCapacityMetricsMap(),
      },
      expansionSignalsStore: {
        get: (id) => this.expansion.getRegionalExpansionSignal(id) ?? undefined,
        set: (id, v) => this.expansion.setRegionalExpansionSignal(id, v!),
        getMap: () => this.expansion.getRegionalExpansionSignalsMap(),
      },
      expansionUnlocksStore: {
        get: (id) => this.expansion.getExpansionUnlock(id) ?? undefined,
        set: (id, v) => this.expansion.setExpansionUnlock(id, v!),
        getMap: () => this.expansion.getExpansionUnlocksMap(),
      },
      operationalCostProfilesStore: {
        get: (id) => this.pricingService.getOperationalCostProfile(id) ?? undefined,
        set: (id, v) => this.pricingService.setOperationalCostProfileById(id, v),
        getMap: () => this.pricingService.getOperationalCostProfilesMap(),
      },
      orchestrator: {
        getStores: (scope?, valueCents?) => this.catalog.getStores(scope, valueCents),
        getServiceResourcesByStore: (storeId) => this.capacity.getServiceResourcesByStore(storeId),
        getCapacityEventsMap: () => this.capacityApplicationService.getCapacityEventsMap(),
        getServiceRequestsMap: () => this.dispatchModule.getServiceRequestsMap(),
        getServiceDispatchesMap: () => this.dispatchModule.getServiceDispatchesMap(),
        getServiceGovernanceMetricsMap: () => this.complianceModule.getServiceGovernanceMetricsMap(),
        getCategories: () => this.catalog.getCategories(),
      },
    });
    this.paymentsApplicationService = new PaymentsApplicationService({
      paymentInfrastructureConfigStore: {
        get: (id) => this.paymentsDomain.getPaymentInfrastructureConfig(id) ?? undefined,
        set: (id, v) => this.paymentsDomain.setPaymentInfrastructureConfig(id, v!),
        getMap: () => this.paymentsDomain.getPaymentInfrastructureConfigsMap(),
      },
      servicePaymentHoldStore: {
        get: (id) => this.paymentsDomain.getServicePaymentHold(id) ?? undefined,
        set: (id, v) => this.paymentsDomain.setServicePaymentHold(id, v!),
        getMap: () => this.paymentsDomain.getServicePaymentHoldsMap(),
      },
      serviceCompletionSignalStore: {
        get: (id) => this.paymentsDomain.getServiceCompletionSignal(id) ?? undefined,
        set: (id, v) => this.paymentsDomain.setServiceCompletionSignal(id, v!),
        getMap: () => this.paymentsDomain.getServiceCompletionSignalsMap(),
      },
      revenueSnapshotStore: {
        get: (id) => this.paymentsDomain.getRevenueSnapshot(id) ?? undefined,
        set: (id, v) => this.paymentsDomain.setRevenueSnapshot(id, v!),
        getMap: () => this.paymentsDomain.getRevenueSnapshotsMap(),
      },
      orchestrator: {
        getServiceRequest: (requestId) => this.dispatchModule.getServiceRequest(requestId) ?? null,
        getServiceDispatchesMap: () => this.dispatchModule.getServiceDispatchesMap(),
        setServiceRequest: (requestId, req) => this.dispatchModule.setServiceRequest(requestId, req),
        getPaymentPlan: (paymentPlanId) => this.ordersApplicationService.getPaymentPlan(paymentPlanId),
        createDisputeCase: (payload) => {
          const r = this.governance.createDisputeCase({
            orderId: payload.orderId,
            actorInvolved: { actorId: payload.actorInvolved[0] ?? '', actorType: 'customer', role: 'buyer' },
            type: 'payment',
            description: 'Service dispute',
          });
          return { dispute_id: (r as { disputeId?: string; dispute_id?: string }).disputeId ?? (r as { dispute_id?: string }).dispute_id ?? '' };
        },
      },
    });
    this.commerceOperationsApplicationService = new CommerceOperationsApplicationService({
      ordersApplicationService: this.ordersApplicationService,
      industryModule: this.industryModule,
      orchestrator: {
        getRevenueSnapshot: (region, period) => this.paymentsApplicationService.getRevenueSnapshot(region, period),
        getRegionalFundByRegion: (tenantId, region) => regionalFundService.getRegionalFundByRegion(tenantId, region),
      },
    });
    this.marketplaceOrchestrationService.init({
      getCompanyPlan: (planId) => this.company.getCompanyPlan(planId),
      getCompanyOnboardingByCompanyId: (companyId) => this.companyApplicationService.getCompanyOnboardingByCompanyId(companyId),
      regionalActivationService,
      economicIdentityService,
      regionalFundService,
      marketplaceLogger,
      recordIncentiveGrantedEvent: (grant, rule) => this.recordIncentiveGrantedEvent(grant, rule),
      economicModule: this.economicModule,
      getOrdersMap: () => this.ordersApplicationService.getOrdersMap(),
      getProviderDispatchInboxRaw: (providerActorId) => this.dispatch.getProviderDispatchInbox(providerActorId),
      getServiceGovernanceMetricsMap: () => this.complianceModule.getServiceGovernanceMetricsMap(),
      state: this.stateAdapter,
      recordOrderEvent: (event) => { try { this.governance.recordOrderEvent(event as any); } catch { } },
      downgradeTrustLevel: (actorId, reason) => { try { (this as any).downgradeTrustLevel?.(actorId, reason); } catch { } },
    });
    const aggregators = createMarketplaceAggregators({
      ordersApplicationService: this.ordersApplicationService,
      commerceOperationsApplicationService: this.commerceOperationsApplicationService,
      paymentsApplicationService: this.paymentsApplicationService,
      catalogApplicationService: this.catalogApplicationService,
      marketplaceOrchestrationService: this.marketplaceOrchestrationService,
      companyApplicationService: this.companyApplicationService,
      capacityApplicationService: this.capacityApplicationService,
      regionalCapacityApplicationService: this.regionalCapacityApplicationService,
      compensationDomain: this.compensation,
      discoveryApplicationService: this.discoveryApplicationService,
      offeringsApplicationService: this.offeringsApplicationService,
      servicesModule: this.servicesModule,
      serviceLifecycleDomain: this.serviceLifecycle,
      slaModule: this.slaModule,
      complianceModule: this.complianceModule,
      getDispatchAggregatorDeps: () => this.getDispatchAggregatorDeps(),
      paymentsDomain: this.paymentsDomain,
    });
    this.orders = aggregators.orders;
    this.checkout = aggregators.checkout;
    this.payments = aggregators.payments;
    this.dispatch = aggregators.dispatch;
    this.services = aggregators.services;
    this.catalog = aggregators.catalog;
    this.company = aggregators.company;
    this.capacity = aggregators.capacity;
    this.discovery = aggregators.discovery;
    this.governance = aggregators.governance;
    this.b2b = this.b2bService;
    this.pricing = this.pricingService;
    domainEventBus.setLogger({
      debug: (message, meta) => marketplaceLogger.init(message, meta),
      error: (message, err) => marketplaceLogger.error(message, err),
    });
    this.registerDomainEventHandlers();
  }

  /** Register domain event handlers so aggregators react to events (avoids God Facade Drift). */
  private registerDomainEventHandlers(): void {
    domainEventBus.subscribe<ServiceCompletedPayload>(
      ServiceCompletedEventType,
      (e) => this.payments.handleServiceCompleted(e),
      'payments.handleServiceCompleted'
    );
    domainEventBus.subscribe<ServiceCompletedPayload>(
      ServiceCompletedEventType,
      (e) => this.governance.handleServiceCompleted(e),
      'governance.handleServiceCompleted'
    );
    domainEventBus.subscribe<ServiceCompletedPayload>(
      ServiceCompletedEventType,
      (e) => this.capacity.handleServiceCompleted(e),
      'capacity.handleServiceCompleted'
    );
  }

  /** Helper para bootstrap do dispatch aggregator. */
  private getDispatchAggregatorDeps(): IDispatchAggregatorDeps {
    return {
      dispatchApplicationService: this.dispatchApplicationService,
      dispatchModule: this.dispatchModule,
      offeringsApplicationService: this.offeringsApplicationService,
      getDisputeCasesMap: () => this.slaModule.getDisputeCasesMap(),
      getProviderDispatchInbox: (providerActorId) =>
        this.marketplaceOrchestrationService.getProviderDispatchInbox(providerActorId) as Array<{
          dispatchId: string;
          requestId: string;
          request_summary: unknown;
          pre_reservation?: unknown;
          status: string;
          createdAt: string;
        }>,
      presence: {
        set: (id, online) => this.dispatchPresence.setProviderOnlineStatus(id, online),
        get: (id) => this.dispatchPresence.getProviderOnlineStatus(id),
      },
    };
  }

  /* =====================================================
     CATALOG / B2B FACADES (Commit 25 — gateway delega)
     ===================================================== */
  private _catalogFacade?: MarketplaceCatalogFacade;
  get catalogFacade(): MarketplaceCatalogFacade {
    return (this._catalogFacade ??= new MarketplaceCatalogFacade({
      getOrchestration: () => this.marketplaceOrchestrationService,
      getCatalog: () => this.catalog,
      getCatalogApplicationService: () => this.catalogApplicationService,
      getOfferingsApplicationService: () => this.offeringsApplicationService,
      getDispatchPresence: () => this.dispatchPresence,
    }));
  }
  private _b2bFacade?: MarketplaceB2BFacade;
  get b2bFacade(): MarketplaceB2BFacade {
    return (this._b2bFacade ??= new MarketplaceB2BFacade({
      getCatalog: () => this.catalog,
      getStoreProducts: async (
        tenantId: string,
        storeId: string,
        categoryId?: string
      ): Promise<{ products: Array<{ productId: string; isEnabled?: boolean }> } | null> => {
        const r = await this.catalogFacade.getStoreProducts(tenantId, storeId, categoryId);
        return r ? { products: r.products.map((p) => ({ productId: p.productId, isEnabled: p.isEnabled })) } : null;
      },
      getServices: () => this.services,
      getOrders: () => this.orders,
      getCheckout: () => this.checkout,
      getPayments: () => this.payments,
      getOfferingsApplicationService: () => this.offeringsApplicationService,
    }));
  }

  /* =====================================================
     FACADE METHODS (delegated to catalog / b2b facades)
     ===================================================== */

  getHealth(): { domain: string; status: string; version: string } {
    return this.catalogFacade.getHealth();
  }

  getHome(): {
    domain: string;
    version: string;
    sections: Array<{ id: string; title: string; type: string; order: number }>;
  } {
    return this.catalogFacade.getHome();
  }

  /**
   * Hook para listagem de serviços importados por loja.
   * Endpoint associado: GET /stores/:storeId/imported-services.
   * Caller: marketplace-templates.routes.ts.
   * Feature ainda não implementada; retorno vazio é intencional.
   */
  getImportedServices(_storeId: string): unknown[] {
    return [];
  }

  /**
   * Hook transversal para emissão de eventos econômicos.
   * Usado por: dispatch application service, dispatch domain, capacity domain, services module e callbacks do orchestration.
   * A implementação atual é intencionalmente mínima; qualquer lógica futura deve ser delegada ao módulo de orchestration.
   */
  generateEconomicEvent(_event: unknown): void {}

  /**
   * Hook para validação de confiança/risco em operações financeiras.
   * Caller atual: domain/orders/marketplace-orders.service.ts (createPaymentPlan com method === 'invoice').
   * Atualmente funciona como placeholder seguro até integração com módulo de trust.
   */
  applyTrustGuards(_input: { actorId: string; action: string; amountCents: number }): void {}

  getStores(scope?: string, valueCents?: string): {
    domain: string;
    version: string;
    scope_applied?: { scope: string; valueCents: string; filter_field: string };
    stores: Array<{
      storeId: string;
      name: string;
      templateId: string;
      location?: { country: string; state: string; city: string; neighborhood?: string; latitude?: number; longitude?: number; visible_in_locator: boolean };
      branches: Array<{
        branch_id: string;
        name: string;
        city: string;
        location?: { country: string; state: string; city: string; neighborhood?: string; latitude?: number; longitude?: number; visible_in_locator: boolean };
        pickup: boolean;
        delivery: boolean;
      }>;
    }>;
  } {
    return this.catalogFacade.getStores(scope, valueCents);
  }

  async getStoreProducts(
    tenantId: string,
    storeId: string,
    categoryId?: string
  ): Promise<{
    domain: string;
    version: string;
    storeId: string;
    products: Array<{
      productId: string;
      name: string;
      description: string | null;
      categoryId: string | null;
      attributes?: Record<string, any>;
      images?: string[];
      isEnabled: boolean;
      price: { amountCents: number; currency: string } | null;
      stock: { quantity: number; unit: string } | null;
      industryId?: string;
      hubId?: string;
      isIndustrial?: boolean;
    }>;
  } | null> {
    return this.catalogFacade.getStoreProducts(tenantId, storeId, categoryId);
  }

  get serviceOfferings() {
    return this.catalogFacade.serviceOfferings;
  }
  get serviceAvailabilities() {
    return this.catalogFacade.serviceAvailabilities;
  }
  get serviceBookings() {
    return this.catalogFacade.serviceBookings;
  }
  private get serviceOrders() {
    return this.offeringsApplicationService.getServiceOrdersMap();
  }

  getServiceBooking(bookingId: string): {
    booking_id: string;
    offeringId: string;
    user_id: string;
    date: string;
    time: string;
    quantity: number;
    status: 'reserved' | 'confirmed' | 'cancelled' | 'in_progress';
    createdAt: string;
  } | null {
    return this.catalogFacade.getServiceBooking(bookingId);
  }

  initializeServiceData(): void {
    this.catalogFacade.initializeServiceData();
  }

  // ============================================================
  // SUBSCRIPTIONS (Commit 19 — métodos-repasse removidos; callers usam facade.subscriptions.*)
  // ============================================================

  // ============================================================
  // INDÚSTRIA, DISTRIBUIÇÃO REGIONAL E DROPSHIP (Commit 21)
  // Métodos-repasse removidos. Callers usam facade.industry.* ou facade.checkout.*
  // ============================================================

  // ============================================================
  // GOVERNANÇA, SLA, REPUTAÇÃO E RISCO (métodos-repasse removidos; callers usam facade.governance.*)
  // ============================================================

  // ============================================================
  // INCENTIVOS ECONÔMICOS DIRECIONADOS (Commit 23)
  // Métodos-repasse removidos. Callers agora usam facade.orchestration.*
  // ============================================================

  /**
   * Registrar evento econômico de incentivo concedido (usado pelo orchestration no wiring).
   */
  private recordIncentiveGrantedEvent(grant: IncentiveGrant, rule: IncentiveRule): void {
    this.generateEconomicEvent({
      type: 'regional_fund_allocation',
      region: grant.region,
      actorId: grant.actorId,
      actorType: grant.actorType,
      reference_id: grant.grantId,
      amountCents: grant.amountCents,
      currency: grant.currency,
      visibility: 'public',
    });
  }

  // ============================================================
  // SISTEMA DE CONTRATOS COMERCIAIS B2B ENTRE ATORES
  // ============================================================

  /* =====================================================
     APPLICATION SERVICES & DOMAIN MODULES (via factories; lazy getters)
     ===================================================== */
  private _b2bService?: ReturnType<IMarketplaceDomainFactories['createB2BService']>;
  private get b2bService(): ReturnType<IMarketplaceDomainFactories['createB2BService']> {
    return (this._b2bService ??= this.domainFactories.createB2BService(this));
  }
  private _subscriptionsService?: ReturnType<IMarketplaceDomainFactories['createSubscriptionsService']>;
  private get subscriptionsService(): ReturnType<IMarketplaceDomainFactories['createSubscriptionsService']> {
    return (this._subscriptionsService ??= this.domainFactories.createSubscriptionsService(this));
  }
  /** Aggregator de assinaturas exposto na API da facade (Commit 19). */
  get subscriptions(): ReturnType<IMarketplaceDomainFactories['createSubscriptionsService']> {
    return this.subscriptionsService;
  }

  /** Adapter que implementa ISubscriptionOrchestrator (delega ao B2B facade). */
  getSubscriptionOrchestratorAdapter(): ISubscriptionOrchestrator {
    return this.b2bFacade.getSubscriptionOrchestratorAdapter();
  }

  readonly vouchers = new MarketplaceVouchersService(this);
  private readonly pricingService = new MarketplacePricingService(this);
  private _compensation?: ReturnType<IMarketplaceDomainFactories['createCompensationService']>;
  private get compensation(): ReturnType<IMarketplaceDomainFactories['createCompensationService']> {
    return (this._compensation ??= this.domainFactories.createCompensationService(this));
  }
  private _dispatchPresence?: ReturnType<IMarketplaceDomainFactories['createDispatchPresenceService']>;
  private get dispatchPresence(): ReturnType<IMarketplaceDomainFactories['createDispatchPresenceService']> {
    return (this._dispatchPresence ??= this.domainFactories.createDispatchPresenceService(this));
  }
  private _serviceLifecycle?: ReturnType<IMarketplaceDomainFactories['createServiceLifecycleService']>;
  private get serviceLifecycle(): ReturnType<IMarketplaceDomainFactories['createServiceLifecycleService']> {
    return (this._serviceLifecycle ??= this.domainFactories.createServiceLifecycleService(this));
  }
  private _expansion?: ReturnType<IMarketplaceDomainFactories['createExpansionService']>;
  private get expansion(): ReturnType<IMarketplaceDomainFactories['createExpansionService']> {
    return (this._expansion ??= this.domainFactories.createExpansionService(this));
  }
  private _paymentsDomain?: ReturnType<IMarketplaceDomainFactories['createPaymentsDomainService']>;
  private get paymentsDomain(): ReturnType<IMarketplaceDomainFactories['createPaymentsDomainService']> {
    return (this._paymentsDomain ??= this.domainFactories.createPaymentsDomainService(this));
  }
  private _productionModule?: ReturnType<IMarketplaceDomainFactories['createProductionModule']>;
  private get productionModule(): ReturnType<IMarketplaceDomainFactories['createProductionModule']> {
    return (this._productionModule ??= this.domainFactories.createProductionModule(this));
  }
  /** Aggregator de compra coletiva programada exposto na API da facade (Commit 20). */
  get production(): ReturnType<IMarketplaceDomainFactories['createProductionModule']> {
    return this.productionModule;
  }
  private _offeringsModule?: ReturnType<IMarketplaceDomainFactories['createOfferingsModule']>;
  get offeringsModule(): ReturnType<IMarketplaceDomainFactories['createOfferingsModule']> {
    return (this._offeringsModule ??= this.domainFactories.createOfferingsModule(this));
  }
  private readonly offeringsApplicationService!: OfferingsApplicationService;
  private _slaModule?: ReturnType<IMarketplaceDomainFactories['createSlaModule']>;
  private get slaModule(): ReturnType<IMarketplaceDomainFactories['createSlaModule']> {
    return (this._slaModule ??= this.domainFactories.createSlaModule(this));
  }
  private _industryModule?: ReturnType<IMarketplaceDomainFactories['createIndustryModule']>;
  private get industryModule(): ReturnType<IMarketplaceDomainFactories['createIndustryModule']> {
    return (this._industryModule ??= this.domainFactories.createIndustryModule(this));
  }
  /** Aggregator de indústria e distribuição regional exposto na API da facade (Commit 21). */
  get industry(): ReturnType<IMarketplaceDomainFactories['createIndustryModule']> {
    return this.industryModule;
  }
  private _economicModule?: ReturnType<IMarketplaceDomainFactories['createEconomicModule']>;
  private get economicModule(): ReturnType<IMarketplaceDomainFactories['createEconomicModule']> {
    return (this._economicModule ??= this.domainFactories.createEconomicModule(this));
  }
  /** Aggregator de consciência de custo e sustentabilidade exposto na API da facade (Commit 22). */
  get economic(): ReturnType<IMarketplaceDomainFactories['createEconomicModule']> {
    return this.economicModule;
  }
  /** Orquestração cross-domain (Commit 22 — exposto para generateEconomicSustainabilitySnapshot e futuros métodos). */
  get orchestration(): MarketplaceOrchestrationService {
    return this.marketplaceOrchestrationService;
  }
  private _companyModule?: ReturnType<IMarketplaceDomainFactories['createCompanyModule']>;
  private get companyModule(): ReturnType<IMarketplaceDomainFactories['createCompanyModule']> {
    return (this._companyModule ??= this.domainFactories.createCompanyModule(this));
  }
  private companyApplicationService!: CompanyApplicationService;
  private _capacityModule?: ReturnType<IMarketplaceDomainFactories['createCapacityModule']>;
  get capacityModule(): ReturnType<IMarketplaceDomainFactories['createCapacityModule']> {
    return (this._capacityModule ??= this.domainFactories.createCapacityModule(this));
  }
  private capacityApplicationService!: CapacityApplicationService;
  private regionalCapacityApplicationService!: RegionalCapacityApplicationService;
  private paymentsApplicationService!: PaymentsApplicationService;
  private dispatchApplicationService!: DispatchApplicationService;
  private ordersApplicationService!: OrdersApplicationService;
  private commerceOperationsApplicationService!: CommerceOperationsApplicationService;

  /** F4: Compliance module com state adapter (visits + quotes). Lazy para usar stateAdapter. */
  private _complianceModule?: MarketplaceComplianceModule;
  private get complianceModule(): MarketplaceComplianceModule {
    return (this._complianceModule ??= new MarketplaceComplianceModule(this, this.stateAdapter));
  }
  /** Aggregator de governança anti-desvio (quote & execução) exposto na API da facade (Commit 24). */
  get compliance(): MarketplaceComplianceModule {
    return this.complianceModule;
  }

  private _stateAdapter?: MarketplaceStateAdapter;
  private _stateSource?: IMarketplaceStateSource;
  /** Fonte de estado que delega aos aggregators (dispatch, services, payments, expansion). */
  private getStateSource(): IMarketplaceStateSource {
    if (this._stateSource) return this._stateSource;
    const self = this;
    this._stateSource = {
      getServiceVisitsMap: () => self.services.getServiceVisitsMap(),
      getServiceQuotesMap: () => self.services.getServiceQuotesMap(),
      getServiceBookingsMap: () => self.services.getServiceBookingsMap(),
      getServiceOrdersMap: () => self.services.getServiceOrdersMap(),
      getServiceRequestsMap: () => self.dispatch.getServiceRequestsMap(),
      getServiceDispatchesMap: () => self.dispatch.getServiceDispatchesMap(),
      getServicePreReservationsMap: () => self.dispatch.getServicePreReservationsMap(),
      getPaymentTerminalsMap: () => self.payments.getPaymentTerminalsMap(),
      getDisputeCasesMap: () => self.dispatch.getDisputeCasesMap(),
      getRegionalCapacitySnapshotsMap: () => self.expansion.getRegionalCapacitySnapshotsMap(),
    };
    return this._stateSource;
  }
  /** Adapter de estado centralizado; usado por servicesModule e pelas factories do module. */
  get stateAdapter(): MarketplaceStateAdapter {
    return (this._stateAdapter ??= new MarketplaceStateAdapter(this.getStateSource()));
  }

  /** F4: Services module com deps da facade (stores + capacity + offerings + economic event). Preferência por stateAdapter quando disponível. */
  private _servicesModule?: MarketplaceServicesModule;
  private get servicesModule(): MarketplaceServicesModule {
    return (this._servicesModule ??= new MarketplaceServicesModule(this, {
      getServiceVisitsMap: () => this.serviceLifecycle.getServiceVisitsMap(),
      getServiceQuotesMap: () => this.serviceLifecycle.getServiceQuotesMap(),
      getUserRequestHistoryMap: () => this.dispatchPresence.getUserRequestHistoryMap(),
      getServiceOfferingsEntries: () => Array.from(this.offeringsModule.getServiceOfferingsMap().entries()) as [string, { offering_id: string; storeId: string; templateId: string; price: { amountCents: number; currency: string }; duration_minutes?: number; recurrence?: 'weekly' | 'monthly'; isActive: boolean }][],
      getServiceOfferingsAll: () => Array.from(this.offeringsModule.getServiceOfferingsMap().values()),
      getCapacityEventsMap: () => this.capacityModule.getCapacityEventsMap(),
      getRegionalCapacityMetricsMap: () => this.expansion.getRegionalCapacityMetricsMap(),
      getServiceGovernanceMetricsMap: () => this.complianceModule.getServiceGovernanceMetricsMap(),
      setServiceResource: (...args) => this.capacityModule.setServiceResource(...args),
      setResourceCapacityMetrics: (...args) => this.capacityModule.setResourceCapacityMetrics(...args),
      setCompanyCapacityMetrics: (...args) => this.capacityModule.setCompanyCapacityMetrics(...args),
      recordCapacityEvent: (...args) => this.capacityModule.recordCapacityEvent(...args),
      triggerEconomicEvent: (event) => this.generateEconomicEvent(event),
    }, this.stateAdapter));
  }

  getServiceOffering(offeringId: string): ServiceOffering | null {
    return this.b2bFacade.getServiceOffering(offeringId);
  }

  createServiceOffering(offering: {
    offering_id: string;
    storeId: string;
    templateId: string;
    price: { amountCents: number; currency: string };
    duration_minutes?: number;
    recurrence?: 'weekly' | 'monthly';
    isActive: boolean;
  }): void {
    this.b2bFacade.createServiceOffering(offering);
  }

  async getEconomicIdentity(tenantId: string, userId: string): Promise<EconomicIdentity | null> {
    return this.b2bFacade.getEconomicIdentity(tenantId, userId);
  }

  // ============================================================
  // SISTEMA DE CONSCIÊNCIA DE CUSTO E SUSTENTABILIDADE (Commit 22)
  // Métodos-repasse removidos. Callers usam facade.economic.* ou facade.orchestration.*
  // ============================================================

  // ============================================================
  // COMPRA COLETIVA PROGRAMADA (Commit 20 — métodos-repasse removidos; callers usam facade.production.*)
  // ============================================================

  // ============================================================
  // ONBOARDING UNIFICADO DE EMPRESAS + CONEXÃO AUTOMÁTICA
  // ============================================================

  /* =====================================================
     STORES (estado do módulo)
     Maps e estado in-memory; não mover para fora do facade.
     ===================================================== */
  /**
   * Mapear categoria para tipo de ator (usado pelo CompanyApplicationService via orchestrator)
   */
  mapCategoryToActorType(
    category: 'product' | 'service' | 'industry' | 'hub' | 'hybrid'
  ): 'store' | 'service_provider' | 'industry' | 'hub' {
    return this.marketplaceOrchestrationService.mapCategoryToActorType(category);
  }

  // ============================================================
  // FECHAMENTO DO CICLO: ATIVAÇÃO ECONÔMICA + MONETIZAÇÃO
  // (métodos-repasse removidos; callers usam facade.payments / facade.dispatch / facade.services)
  // ============================================================

  /* =====================================================
     APPLICATION SERVICES (dispatch, catalog, discovery, orders, commerce)
     + EventBus, handlers, adapters.
     ===================================================== */
  readonly eventBus = marketplaceEventBus;
  private _dispatchModule?: ReturnType<IMarketplaceDomainFactories['createDispatchModule']>;
  private get dispatchModule(): ReturnType<IMarketplaceDomainFactories['createDispatchModule']> {
    return (this._dispatchModule ??= this.domainFactories.createDispatchModule(this));
  }
  private readonly templatesModule = new MarketplaceTemplatesModule(this);
  private readonly catalogApplicationService = new CatalogApplicationService({
    orchestrator: {
      getStores: (scope?: string, valueCents?: string) => this.catalog.getStores(scope, valueCents),
      getCategories: () => this.catalog.getCategories(),
    },
    storeProductService,
    templatesModule: this.templatesModule,
  });
  private readonly discoveryApplicationService = new DiscoveryApplicationService({
    orchestrator: {
      getStores: (scope?: string, valueCents?: string) => this.catalog.getStores(scope, valueCents),
      getCategories: () => this.catalog.getCategories(),
    },
  });
  private _ordersModule?: ReturnType<IMarketplaceDomainFactories['createOrdersModule']>;
  public get ordersModule(): ReturnType<IMarketplaceDomainFactories['createOrdersModule']> {
    return (this._ordersModule ??= this.domainFactories.createOrdersModule(this));
  }

  // DispatchAccepted: handlers registados em registerCoreHandlers → eventBus canónico (outbox + worker).

  // Commit 17–24: métodos-repasse removidos; callers usam facade.dispatch.*, .payments.*, .services.*, .compliance.*, .catalog.*, .capacity.*, .vouchers.*, .pricing.*
}

// Instância singleton do service (bootstrap via module; domain criado nas factories)
export const marketplaceService = createMarketplaceService();

