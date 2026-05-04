// backend/src/modules/marketplace/marketplace.service.company.ts
// Módulo Company / Onboarding — ciclo de vida de empresas e onboarding

import type { MarketplaceService } from '../../marketplace.service';
import type { CompanyOnboarding, CompanyPlan, PaymentTerminal } from '@contracts/marketplace';
import { marketplaceLogger } from '../../marketplace.logger';
import { economicIdentityService } from '../../economic-identity.service';
import type { IMarketplaceStateReader } from '../../state/marketplace-state.adapter';

type FacadeWithOptionalRecordStore = MarketplaceService & {
  recordNewStoreOpenedEvent?(payload: { storeId: string; region: { country: string; state: string; city: string; neighborhood?: string } }): void;
};

export class MarketplaceCompanyModule {
  private companyOnboardings: Map<string, CompanyOnboarding> = new Map();
  private companyPlans: Map<string, CompanyPlan> = new Map();
  private companyActivationStates: Map<string, {
    companyId: string;
    catalog_ready: boolean;
    services_ready: boolean;
    agenda_configured: boolean;
    dispatch_enabled: boolean;
    quote_flow_enabled: boolean;
    pdvEnabled: boolean;
    b2b_enabled: boolean;
    updatedAt: string;
  }> = new Map();

  constructor(
    private readonly facade: MarketplaceService,
    private readonly state?: IMarketplaceStateReader
  ) {}

  initializeCompanyPlans(): void {
    const basicPlan: CompanyPlan = {
      planId: 'basic',
      name: 'basic',
      displayName: 'Básico',
      description: 'Plano básico gratuito com funcionalidades essenciais',
      capabilities: {
        maxStores: 1,
        maxBranches: 1,
        maxProducts: 50,
        maxServices: 10,
        maxMonthlyTransactions: 1000,
        b2bContractsEnabled: false,
        industryEnabled: false,
        hubEnabled: false,
        batchProductionEnabled: false,
        pdvEnabled: true,
        advancedAnalytics: false,
      },
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const professionalPlan: CompanyPlan = {
      planId: 'professional',
      name: 'professional',
      displayName: 'Profissional',
      description: 'Plano profissional com mais limites e capacidades',
      capabilities: {
        maxStores: 5,
        maxBranches: 10,
        maxProducts: 500,
        maxServices: 50,
        maxMonthlyTransactions: 10000,
        b2bContractsEnabled: true,
        industryEnabled: false,
        hubEnabled: false,
        batchProductionEnabled: false,
        pdvEnabled: true,
        advancedAnalytics: true,
      },
      price: {
        amountCents: 99.00,
        currency: 'BRL',
        billingCycle: 'monthly',
      },
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const industrialPlan: CompanyPlan = {
      planId: 'industrial',
      name: 'industrial',
      displayName: 'Industrial / Hub',
      description: 'Plano para indústrias e hubs com alto volume',
      capabilities: {
        maxStores: 20,
        maxBranches: 50,
        maxProducts: 10000,
        maxServices: 200,
        maxMonthlyTransactions: 1000000,
        b2bContractsEnabled: true,
        industryEnabled: true,
        hubEnabled: true,
        batchProductionEnabled: true,
        pdvEnabled: true,
        advancedAnalytics: true,
      },
      price: {
        amountCents: 499.00,
        currency: 'BRL',
        billingCycle: 'monthly',
      },
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.companyPlans.set('basic', basicPlan);
    this.companyPlans.set('professional', professionalPlan);
    this.companyPlans.set('industrial', industrialPlan);

    marketplaceLogger.init('Planos de empresa inicializados', {
      plans_count: 3,
    });
  }

  getCompanyPlan(planId: string): CompanyPlan | null {
    return this.companyPlans.get(planId) || null;
  }

  getAllCompanyPlans(): CompanyPlan[] {
    return Array.from(this.companyPlans.values());
  }

  createCompanyOnboarding(input: {
    companyType: 'cnpj' | 'cpf' | 'mei';
    companyName: string;
    document: string;
    category: 'product' | 'service' | 'industry' | 'hub' | 'hybrid';
    region: {
      country: string;
      state: string;
      city: string;
      neighborhood?: string;
    };
    documents: {
      cnpj?: string;
      qsaDocument?: string;
      lastContractualChange?: string;
      addressProof?: string;
    };
    bankAccount: {
      type: 'unifibank' | 'external';
      accountId?: string;
      externalBankName?: string;
      externalAccountNumber?: string;
      isVerified: boolean;
    };
    marketplaceEnabled: boolean;
    servicesEnabled: boolean;
    productsEnabled: boolean;
    pdvEnabled: boolean;
    paymentInfrastructure: {
      acceptUnificard: boolean;
      acceptExternalGateway: boolean;
      externalGatewayProvider?: string;
    };
    planId?: string;
  }): CompanyOnboarding {
    const onboardingId = `onboarding-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const companyId = `company-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const planId = input.planId || 'basic';
    const plan = this.getCompanyPlan(planId);
    if (!plan) {
      throw new Error(`Plano não encontrado: ${planId}`);
    }

    const onboarding: CompanyOnboarding = {
      onboardingId: onboardingId,
      companyId: companyId,
      companyType: input.companyType,
      companyName: input.companyName,
      document: input.document,
      category: input.category,
      region: input.region,
      documents: {
        cnpj: input.documents.cnpj,
        qsaDocument: input.documents.qsaDocument,
        lastContractualChange: input.documents.lastContractualChange,
        addressProof: input.documents.addressProof,
      },
      bankAccount: {
        type: input.bankAccount.type,
        accountId: input.bankAccount.accountId,
        externalBankName: input.bankAccount.externalBankName,
        externalAccountNumber: input.bankAccount.externalAccountNumber,
        isVerified: input.bankAccount.isVerified,
      },
      marketplaceEnabled: input.marketplaceEnabled,
      servicesEnabled: input.servicesEnabled,
      productsEnabled: input.productsEnabled,
      pdvEnabled: input.pdvEnabled,
      paymentInfrastructure: {
        acceptUnificard: input.paymentInfrastructure.acceptUnificard,
        acceptExternalGateway: input.paymentInfrastructure.acceptExternalGateway,
        externalGatewayProvider: input.paymentInfrastructure.externalGatewayProvider,
      },
      planId: planId,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.companyOnboardings.set(onboardingId, onboarding);

    marketplaceLogger.init('Processo de onboarding de empresa criado', {
      onboardingId: onboardingId,
      companyId: companyId,
      companyName: input.companyName,
    });

    return onboarding;
  }

  getCompanyOnboarding(onboardingId: string): CompanyOnboarding | null {
    return this.companyOnboardings.get(onboardingId) || null;
  }

  setCompanyOnboarding(onboardingId: string, onboarding: CompanyOnboarding): void {
    this.companyOnboardings.set(onboardingId, onboarding);
  }

  getCompanyOnboardingByCompanyId(companyId: string): CompanyOnboarding | null {
    return Array.from(this.companyOnboardings.values()).find((o) => o.companyId === companyId) || null;
  }

  /**
   * Atualizar estado de ativação de uma empresa
   */
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
    let state = this.companyActivationStates.get(companyId);
    if (!state) {
      state = {
        companyId: companyId,
        catalog_ready: false,
        services_ready: false,
        agenda_configured: false,
        dispatch_enabled: false,
        quote_flow_enabled: false,
        pdvEnabled: false,
        b2b_enabled: false,
        updatedAt: new Date().toISOString(),
      };
    }

    Object.assign(state, updates);
    state.updatedAt = new Date().toISOString();

    this.companyActivationStates.set(companyId, state);

    marketplaceLogger.init('Estado de ativação atualizado', {
      companyId: companyId,
      updates,
    });

    return state;
  }

  /**
   * Buscar estado de ativação de uma empresa
   */
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
    return this.companyActivationStates.get(companyId) || null;
  }

  /**
   * Completar onboarding (conectar automaticamente ao ecossistema)
   * @deprecated Use CompanyOnboardingWizard (frontend) que salva em company.metadata.onboarding
   */
  async completeCompanyOnboarding(tenantId: string, onboardingId: string): Promise<CompanyOnboarding> {
    const onboarding = this.getCompanyOnboarding(onboardingId);
    if (!onboarding) {
      throw new Error('Onboarding não encontrado');
    }

    if (onboarding.status !== 'draft' && onboarding.status !== 'in_progress') {
      throw new Error('Onboarding já foi completado ou falhou');
    }

    if (onboarding.companyType === 'cnpj' && !onboarding.documents.cnpj) {
      throw new Error('CNPJ é obrigatório para empresas do tipo CNPJ');
    }

    if (!onboarding.documents.addressProof) {
      throw new Error('Comprovante de endereço é obrigatório');
    }

    if (!onboarding.bankAccount) {
      throw new Error('Conta bancária é obrigatória');
    }

    if (!onboarding.bankAccount.isVerified) {
      throw new Error('Conta bancária deve ser verificada antes de completar o onboarding');
    }

    if (!onboarding.paymentInfrastructure) {
      throw new Error('Configuração de infraestrutura de pagamento é obrigatória');
    }

    onboarding.status = 'in_progress';
    onboarding.updatedAt = new Date().toISOString();
    this.setCompanyOnboarding(onboardingId, onboarding);

    try {
      const economicIdentity = await economicIdentityService.createEconomicIdentity(tenantId, {
        actorId: onboarding.companyId,
        actorType: this.mapCategoryToActorType(onboarding.category),
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
          const facadeWithRecord = this.facade as FacadeWithOptionalRecordStore;
          if (typeof facadeWithRecord.recordNewStoreOpenedEvent === 'function') {
            facadeWithRecord.recordNewStoreOpenedEvent({
              storeId: newStoreId,
              region: onboarding.region,
            });
          }
        } catch {
          // Ignorar se método não existir
        }

        if (onboarding.businessTemplateId) {
          try {
            this.facade.catalog.recordBusinessTemplateUsage(onboarding.businessTemplateId, onboarding.companyId);

            const businessTemplate = this.facade.catalog.getBusinessTemplate(onboarding.businessTemplateId);
            if (businessTemplate) {
              const importResult = await this.facade.catalog.importCanonicalCatalog(
                tenantId,
                onboarding.companyId,
                newStoreId,
                onboarding.businessTemplateId,
                { import_all: true }
              );

              this.updateCompanyActivationState(onboarding.companyId, {
                catalog_ready: importResult.imported_products > 0 || importResult.imported_services > 0,
                services_ready: importResult.imported_services > 0,
                agenda_configured: businessTemplate.operationalConfig.requiresAgenda,
                dispatch_enabled: businessTemplate.operationalConfig.supportsDispatch,
                quote_flow_enabled: businessTemplate.operationalConfig.supportsQuoteFlow,
                pdvEnabled: businessTemplate.operationalConfig.supportsPdv,
                b2b_enabled: businessTemplate.operationalConfig.supportsB2b,
              });

              marketplaceLogger.init('Catálogo canônico importado e operações ativadas durante onboarding', {
                companyId: onboarding.companyId,
                storeId: newStoreId,
                templateId: onboarding.businessTemplateId,
                imported_products: importResult.imported_products,
                imported_services: importResult.imported_services,
                operationalConfig: businessTemplate.operationalConfig,
              });
            }
          } catch (err) {
            marketplaceLogger.error('Erro ao importar catálogo canônico durante onboarding', err);
          }
        }
      }

      if (onboarding.category === 'industry' || onboarding.category === 'hybrid') {
        const industryAccount = this.facade.industry.createIndustryAccount({
          name: onboarding.companyName,
          cnpj: onboarding.document,
          categoriesSupported: [],
          defaultMarginRules: {
            hubMarginPercentage: 500,
            storeMarginPercentage: 200,
          },
        });
        onboarding.industryAccountId = industryAccount.industryId;
      }

      if (onboarding.category === 'hub' || onboarding.category === 'hybrid') {
        const hub = this.facade.industry.createDistributionHub({
          industryId: onboarding.industryAccountId || onboarding.companyId,
          name: onboarding.companyName,
          location: onboarding.region,
          supportedProducts: [],
          fulfillmentType: 'delivery',
          margin_override: { percentage: 3 },
          logisticsProfile: { defaultEtaMinutes: 30, supportedVehicles: ['bike', 'moto', 'car', 'van'] },
        });
        onboarding.hubId = hub.hubId;
      }

      onboarding.status = 'completed';
      onboarding.completedAt = new Date().toISOString();
      onboarding.updatedAt = new Date().toISOString();
      this.setCompanyOnboarding(onboardingId, onboarding);

      marketplaceLogger.init('Onboarding de empresa completado', {
        onboardingId,
        companyId: onboarding.companyId,
        economicIdentityId: onboarding.economicIdentityId,
      });

      return onboarding;
    } catch (error: unknown) {
      onboarding.status = 'failed';
      onboarding.updatedAt = new Date().toISOString();
      this.setCompanyOnboarding(onboardingId, onboarding);

      marketplaceLogger.error('Erro ao completar onboarding', error);
      throw error;
    }
  }

  private mapCategoryToActorType(
    category: 'product' | 'service' | 'industry' | 'hub' | 'hybrid'
  ): 'store' | 'service_provider' | 'industry' | 'hub' {
    switch (category) {
      case 'product':
        return 'store';
      case 'service':
        return 'service_provider';
      case 'industry':
        return 'industry';
      case 'hub':
        return 'hub';
      case 'hybrid':
        return 'store';
    }
  }

  getCompanyPaymentTerminals(companyId: string): PaymentTerminal[] {
    const terminalsMap = this.state?.paymentTerminals ?? this.facade.payments.getPaymentTerminalsMap();
    return Array.from(terminalsMap.values()).filter((t) => t.companyId === companyId);
  }

  validateCompanyPlanLimits(
    companyId: string,
    action: 'create_store' | 'create_branch' | 'create_product' | 'create_service' | 'execute_transaction' | 'create_b2b' | 'create_industry' | 'create_hub' | 'create_batch',
    currentCount?: number
  ): { allowed: boolean; reason?: string; soft_block?: boolean } {
    const onboarding = this.getCompanyOnboardingByCompanyId(companyId);
    if (!onboarding) {
      return { allowed: false, reason: 'Empresa não encontrada' };
    }

    const plan = this.getCompanyPlan(onboarding.planId);
    if (!plan) {
      return { allowed: false, reason: 'Plano não encontrado' };
    }

    switch (action) {
      case 'create_store':
        if (currentCount !== undefined && plan.capabilities.maxStores && currentCount >= plan.capabilities.maxStores) {
          return { allowed: false, reason: `Limite de lojas atingido (${plan.capabilities.maxStores})`, soft_block: true };
        }
        break;

      case 'create_branch':
        if (currentCount !== undefined && plan.capabilities.maxBranches && currentCount >= plan.capabilities.maxBranches) {
          return { allowed: false, reason: `Limite de filiais atingido (${plan.capabilities.maxBranches})`, soft_block: true };
        }
        break;

      case 'create_product':
        if (currentCount !== undefined && plan.capabilities.maxProducts && currentCount >= plan.capabilities.maxProducts) {
          return { allowed: false, reason: `Limite de produtos atingido (${plan.capabilities.maxProducts})`, soft_block: true };
        }
        break;

      case 'create_service':
        if (currentCount !== undefined && plan.capabilities.maxServices && currentCount >= plan.capabilities.maxServices) {
          return { allowed: false, reason: `Limite de serviços atingido (${plan.capabilities.maxServices})`, soft_block: true };
        }
        break;

      case 'create_b2b':
        if (!plan.capabilities.b2bContractsEnabled) {
          return { allowed: false, reason: 'Contratos B2B não habilitados no plano atual' };
        }
        break;

      case 'create_industry':
        if (!plan.capabilities.industryEnabled) {
          return { allowed: false, reason: 'Produtos industriais não habilitados no plano atual' };
        }
        break;

      case 'create_hub':
        if (!plan.capabilities.hubEnabled) {
          return { allowed: false, reason: 'Hubs não habilitados no plano atual' };
        }
        break;

      case 'create_batch':
        if (!plan.capabilities.batchProductionEnabled) {
          return { allowed: false, reason: 'Lotes de produção não habilitados no plano atual' };
        }
        break;
    }

    return { allowed: true };
  }
}