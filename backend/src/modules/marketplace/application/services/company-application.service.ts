// backend/src/modules/marketplace/application/services/company-application.service.ts
// Application Service: orquestração do domínio Company (delegação ao domain module + lógica extraída da facade).

import type { MarketplaceCompanyModule } from '../../domain/company/marketplace-company.service';
import type {
  CompanyOnboarding,
  CompanyPlan,
  PaymentTerminal,
  IndustryAccount,
  DistributionHub,
} from '@contracts/marketplace';
import type { BusinessTemplate } from '@contracts/marketplace';
import type { CreateEconomicIdentityInput } from '../../economic-identity.service';
import { marketplaceLogger } from '../../marketplace.logger';

/** Dependências para completeCompanyOnboarding e payment terminals (injetadas pela facade). */
export interface ICompanyApplicationDeps {
  regionalFundService: {
    getRegionalFundByRegion(tenantId: string, region: { country: string; state: string; city: string; neighborhood?: string }): Promise<{ regionalFundId: string } | null>;
    createRegionalFund(tenantId: string, input: unknown): Promise<{ regionalFundId: string }>;
    recordRegionalFundCredit(tenantId: string, input: { regional_fund_id: string; amountCents: number; currency: string; source: string; reference_id: string }): Promise<unknown>;
  };
  economicIdentityService: {
    createEconomicIdentity(tenantId: string, input: CreateEconomicIdentityInput): Promise<{ economicIdentityId: string }>;
  };
  orchestrator: {
    getStores(scope?: string, valueCents?: string): { stores: unknown[] };
    recordNewStoreOpenedEvent?(payload: { storeId: string; region: { country: string; state: string; city: string; neighborhood?: string } }): void;
    catalog: {
      recordBusinessTemplateUsage(templateId: string, companyId: string): void;
      getBusinessTemplate(templateId: string): BusinessTemplate | null;
      importCanonicalCatalog(
        tenantId: string,
        companyId: string,
        storeId: string,
        businessTemplateId: string,
        options?: { import_all?: boolean }
      ): Promise<{ imported_products: number; imported_services: number }>;
    };
    updateCompanyActivationState(companyId: string, updates: Partial<{
      catalog_ready: boolean;
      services_ready: boolean;
      agenda_configured: boolean;
      dispatch_enabled: boolean;
      quote_flow_enabled: boolean;
      pdvEnabled: boolean;
      b2b_enabled: boolean;
    }>): unknown;
    industry: {
      createIndustryAccount(input: {
        name: string;
        cnpj: string;
        categoriesSupported: string[];
        defaultMarginRules: { hubMarginPercentage: number; storeMarginPercentage: number; minimumPrice?: number };
        authorizedHubs?: string[];
      }): IndustryAccount;
      createDistributionHub(input: {
        industryId: string;
        name: string;
        location: { country: string; state: string; city: string; neighborhood?: string };
        supportedProducts: string[];
        fulfillmentType: 'pickup' | 'delivery' | 'mixed';
        margin_override?: { percentage?: number };
        logisticsProfile: { defaultEtaMinutes: number; supportedVehicles: Array<'bike' | 'moto' | 'car' | 'van' | 'truck'> };
      }): DistributionHub;
    };
    mapCategoryToActorType(category: 'product' | 'service' | 'industry' | 'hub' | 'hybrid'): 'store' | 'service_provider' | 'industry' | 'hub';
  };
  terminalStore: {
    set(terminalId: string, terminal: PaymentTerminal): void;
    get(terminalId: string): PaymentTerminal | null;
    getMap(): Map<string, PaymentTerminal>;
  };
}

export class CompanyApplicationService {
  constructor(
    private readonly companyModule: MarketplaceCompanyModule,
    private readonly deps?: ICompanyApplicationDeps
  ) {}

  initializeCompanyPlans(): void {
    this.companyModule.initializeCompanyPlans();
  }

  getCompanyPlan(planId: string): CompanyPlan | null {
    return this.companyModule.getCompanyPlan(planId);
  }

  getAllCompanyPlans(): CompanyPlan[] {
    return this.companyModule.getAllCompanyPlans();
  }

  createCompanyOnboarding(input: {
    companyType: 'cnpj' | 'cpf' | 'mei';
    companyName: string;
    document: string;
    category: 'product' | 'service' | 'industry' | 'hub' | 'hybrid';
    region: { country: string; state: string; city: string; neighborhood?: string };
    documents: { cnpj?: string; qsaDocument?: string; lastContractualChange?: string; addressProof?: string };
    bankAccount: { type: 'unifibank' | 'external'; accountId?: string; externalBankName?: string; externalAccountNumber?: string; isVerified: boolean };
    marketplaceEnabled: boolean;
    servicesEnabled: boolean;
    productsEnabled: boolean;
    pdvEnabled: boolean;
    paymentInfrastructure: { acceptUnificard: boolean; acceptExternalGateway: boolean; externalGatewayProvider?: string };
    planId?: string;
  }): CompanyOnboarding {
    return this.companyModule.createCompanyOnboarding(input);
  }

  getCompanyOnboarding(onboardingId: string): CompanyOnboarding | null {
    return this.companyModule.getCompanyOnboarding(onboardingId);
  }

  setCompanyOnboarding(onboardingId: string, onboarding: CompanyOnboarding): void {
    this.companyModule.setCompanyOnboarding(onboardingId, onboarding);
  }

  getCompanyOnboardingByCompanyId(companyId: string): CompanyOnboarding | null {
    return this.companyModule.getCompanyOnboardingByCompanyId(companyId);
  }

  getCompanyPaymentTerminals(companyId: string): PaymentTerminal[] {
    return this.companyModule.getCompanyPaymentTerminals(companyId);
  }

  getCompanyActivationState(companyId: string): {
    companyId: string;
    catalog_ready: boolean;
    services_ready: boolean;
    agenda_configured: boolean;
    dispatch_enabled: boolean;
    quote_flow_enabled: boolean;
    pdvEnabled: boolean;
    b2b_enabled: boolean;
    updatedAt: string;
  } | null {
    return this.companyModule.getCompanyActivationState(companyId);
  }

  updateCompanyActivationState(
    companyId: string,
    updates: Partial<{
      catalog_ready: boolean;
      services_ready: boolean;
      agenda_configured: boolean;
      dispatch_enabled: boolean;
      quote_flow_enabled: boolean;
      pdvEnabled: boolean;
      b2b_enabled: boolean;
    }>
  ): {
    companyId: string;
    catalog_ready: boolean;
    services_ready: boolean;
    agenda_configured: boolean;
    dispatch_enabled: boolean;
    quote_flow_enabled: boolean;
    pdvEnabled: boolean;
    b2b_enabled: boolean;
    updatedAt: string;
  } {
    return this.companyModule.updateCompanyActivationState(companyId, updates);
  }

  async completeCompanyOnboarding(tenantId: string, onboardingId: string): Promise<CompanyOnboarding> {
    if (!this.deps) {
      return this.companyModule.completeCompanyOnboarding(tenantId, onboardingId);
    }
    const { regionalFundService, economicIdentityService, orchestrator } = this.deps;
    const onboarding = this.companyModule.getCompanyOnboarding(onboardingId);
    if (!onboarding) throw new Error('Onboarding não encontrado');
    if (onboarding.status !== 'draft' && onboarding.status !== 'in_progress') {
      throw new Error('Onboarding já foi completado ou falhou');
    }
    if (onboarding.companyType === 'cnpj' && !onboarding.documents.cnpj) {
      throw new Error('CNPJ é obrigatório para empresas do tipo CNPJ');
    }
    if (!onboarding.documents.addressProof) throw new Error('Comprovante de endereço é obrigatório');
    if (!onboarding.bankAccount) throw new Error('Conta bancária é obrigatória');
    if (!onboarding.bankAccount.isVerified) {
      throw new Error('Conta bancária deve ser verificada antes de completar o onboarding');
    }
    if (!onboarding.paymentInfrastructure) {
      throw new Error('Configuração de infraestrutura de pagamento é obrigatória');
    }
    onboarding.status = 'in_progress';
    onboarding.updatedAt = new Date().toISOString();
    this.companyModule.setCompanyOnboarding(onboardingId, onboarding);
    try {
      let regionalFund = await regionalFundService.getRegionalFundByRegion(tenantId, onboarding.region);
      if (!regionalFund) {
        regionalFund = await regionalFundService.createRegionalFund(tenantId, {
          region: onboarding.region,
          rules: { min_reserve: 10000, max_monthly_outflow: 50000, allowed_uses: ['infrastructure', 'incentives', 'emergency'] },
          governance: { decision_maker: 'automatic', approval_required: false },
        });
      }
      const economicIdentity = await economicIdentityService.createEconomicIdentity(tenantId, {
        actorId: onboarding.companyId,
        actorType: orchestrator.mapCategoryToActorType(onboarding.category) as CreateEconomicIdentityInput['actorType'],
        verified_assets: {
          documents_verified: true,
          bank_account_verified: onboarding.bankAccount.isVerified,
          company_verified: onboarding.companyType !== 'cpf',
        },
      });
      onboarding.economicIdentityId = economicIdentity.economicIdentityId;
      if (onboarding.marketplaceEnabled && (onboarding.category === 'product' || onboarding.category === 'hybrid')) {
        const newStoreId = `store-${onboarding.companyId}`;
        const newBranchId = `branch-${onboarding.companyId}-001`;
        onboarding.storeId = newStoreId;
        onboarding.branchId = newBranchId;
        try {
          if (typeof orchestrator.recordNewStoreOpenedEvent === 'function') {
            orchestrator.recordNewStoreOpenedEvent({ storeId: newStoreId, region: onboarding.region });
          }
        } catch {
          // ignore
        }
        const businessTemplateId = (onboarding as { businessTemplateId?: string }).businessTemplateId;
        if (businessTemplateId) {
          try {
            orchestrator.catalog.recordBusinessTemplateUsage(businessTemplateId, onboarding.companyId);
            const businessTemplate = orchestrator.catalog.getBusinessTemplate(businessTemplateId);
            if (businessTemplate) {
              const importResult = await orchestrator.catalog.importCanonicalCatalog(
                tenantId,
                onboarding.companyId,
                newStoreId,
                businessTemplateId,
                { import_all: true }
              );
              orchestrator.updateCompanyActivationState(onboarding.companyId, {
                catalog_ready: importResult.imported_products > 0 || importResult.imported_services > 0,
                services_ready: importResult.imported_services > 0,
                agenda_configured: businessTemplate.operationalConfig?.requiresAgenda ?? false,
                dispatch_enabled: businessTemplate.operationalConfig?.supportsDispatch ?? false,
                quote_flow_enabled: businessTemplate.operationalConfig?.supportsQuoteFlow ?? false,
                pdvEnabled: businessTemplate.operationalConfig?.supportsPdv ?? false,
                b2b_enabled: businessTemplate.operationalConfig?.supportsB2b ?? false,
              });
              marketplaceLogger.init('Catálogo canônico importado durante onboarding', {
                companyId: onboarding.companyId,
                storeId: newStoreId,
                templateId: businessTemplateId,
                imported_products: importResult.imported_products,
                imported_services: importResult.imported_services,
              });
            }
          } catch (err) {
            marketplaceLogger.error('Erro ao importar catálogo canônico durante onboarding', err);
          }
        }
      }
      if (onboarding.category === 'industry' || onboarding.category === 'hybrid') {
        const industryAccount = orchestrator.industry.createIndustryAccount({
          name: onboarding.companyName,
          cnpj: onboarding.document,
          categoriesSupported: [],
          defaultMarginRules: { hubMarginPercentage: 500, storeMarginPercentage: 200 },
          authorizedHubs: [],
        });
        (onboarding as { industryAccountId?: string }).industryAccountId = industryAccount.industryId;
      }
      if (onboarding.category === 'hub' || onboarding.category === 'hybrid') {
        const hub = orchestrator.industry.createDistributionHub({
          industryId: (onboarding as { industryAccountId?: string }).industryAccountId || onboarding.companyId,
          name: onboarding.companyName,
          location: onboarding.region,
          supportedProducts: [],
          fulfillmentType: 'delivery',
          margin_override: { percentage: 3 },
          logisticsProfile: { defaultEtaMinutes: 30, supportedVehicles: ['bike', 'moto', 'car', 'van'] },
        });
        (onboarding as { hubId?: string }).hubId = hub.hubId;
      }
      onboarding.status = 'completed';
      (onboarding as { completedAt?: string }).completedAt = new Date().toISOString();
      onboarding.updatedAt = new Date().toISOString();
      this.companyModule.setCompanyOnboarding(onboardingId, onboarding);
      marketplaceLogger.init('Onboarding de empresa completado', {
        onboardingId,
        companyId: onboarding.companyId,
        economicIdentityId: onboarding.economicIdentityId,
      });
      return onboarding;
    } catch (error: unknown) {
      onboarding.status = 'failed';
      onboarding.updatedAt = new Date().toISOString();
      this.companyModule.setCompanyOnboarding(onboardingId, onboarding);
      marketplaceLogger.error('Erro ao completar onboarding', error);
      throw error;
    }
  }

  createPaymentTerminal(input: {
    companyId: string;
    terminalType: 'unified_card' | 'external';
    provider?: string;
  }): PaymentTerminal {
    if (!this.deps?.terminalStore) {
      throw new Error('CompanyApplicationService: terminalStore not injected');
    }
    const terminalId = `terminal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const transactionFeeStructure = {
      baseRate: input.terminalType === 'unified_card' ? 2.5 : 3.0,
      regionalFundPercentage: 0.5,
      platformPercentage: 1.0,
      referralPercentage: 0.2,
    };
    const terminal: PaymentTerminal = {
      terminalId,
      companyId: input.companyId,
      terminalType: input.terminalType,
      provider: input.provider,
      status: 'requested',
      transactionFeeStructure,
      requestedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.deps.terminalStore.set(terminalId, terminal);
    marketplaceLogger.init('Maquininha de pagamento solicitada', { terminalId, companyId: input.companyId, terminalType: input.terminalType });
    return terminal;
  }

  approvePaymentTerminal(terminalId: string): PaymentTerminal {
    if (!this.deps?.terminalStore) throw new Error('CompanyApplicationService: terminalStore not injected');
    const terminal = this.deps.terminalStore.get(terminalId);
    if (!terminal) throw new Error('Maquininha não encontrada');
    terminal.status = 'approved';
    terminal.approvedAt = new Date().toISOString();
    terminal.updatedAt = new Date().toISOString();
    this.deps.terminalStore.set(terminalId, terminal);
    marketplaceLogger.init('Maquininha de pagamento aprovada', { terminalId });
    return terminal;
  }

  async activatePaymentTerminal(tenantId: string, terminalId: string): Promise<PaymentTerminal> {
    if (!this.deps?.terminalStore || !this.deps?.regionalFundService) {
      throw new Error('CompanyApplicationService: terminalStore or regionalFundService not injected');
    }
    const terminal = this.deps.terminalStore.get(terminalId);
    if (!terminal) throw new Error('Maquininha não encontrada');
    if (terminal.status !== 'approved') throw new Error('Maquininha deve ser aprovada antes de ser ativada');
    terminal.status = 'active';
    terminal.activatedAt = new Date().toISOString();
    terminal.updatedAt = new Date().toISOString();
    this.deps.terminalStore.set(terminalId, terminal);
    try {
      const regionalFund = await this.deps.regionalFundService.getRegionalFundByRegion(tenantId, { country: 'BR', state: 'PR', city: 'Curitiba' });
      if (regionalFund) {
        await this.deps.regionalFundService.recordRegionalFundCredit(tenantId, {
          regional_fund_id: regionalFund.regionalFundId,
          amountCents: 0,
          currency: 'BRL',
          source: 'payment_terminal_setup',
          reference_id: terminalId,
        });
      }
    } catch {
      marketplaceLogger.init('Evento de Fundo Regional não registrado (método não disponível)');
    }
    marketplaceLogger.init('Maquininha de pagamento ativada', { terminalId });
    return terminal;
  }
}