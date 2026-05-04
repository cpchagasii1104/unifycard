// backend/src/modules/marketplace/services/marketplace-company.service.ts
// Agregador: onboarding, company plans, terminais de pagamento (lógica).
// Estado (terminals, etc.) vive nos domain services; facade apenas delega.

import type { CompanyOnboarding, CompanyPlan, PaymentTerminal, CompanyCollaborator } from '@contracts/marketplace';
import type { CompanyApplicationService } from '../application/services/company-application.service';
import type { MarketplaceOrchestrationService } from '../application/services/marketplace-orchestration.service';

const NOT_IMPLEMENTED_COLLABORATIONS = 'Collaborations: not implemented';

export class MarketplaceCompanyAggregatorService {
  constructor(
    private readonly company: CompanyApplicationService,
    private readonly orchestration: MarketplaceOrchestrationService
  ) {}

  initializeCompanyPlans(): void {
    this.company.initializeCompanyPlans();
  }

  getCompanyPlan(planId: string): CompanyPlan | null {
    return this.company.getCompanyPlan(planId);
  }

  getAllCompanyPlans(): CompanyPlan[] {
    return this.company.getAllCompanyPlans();
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
    return this.company.createCompanyOnboarding(input);
  }

  async completeCompanyOnboarding(tenantId: string, onboardingId: string): Promise<CompanyOnboarding> {
    return this.company.completeCompanyOnboarding(tenantId, onboardingId);
  }

  createPaymentTerminal(input: {
    companyId: string;
    terminalType: 'unified_card' | 'external';
    provider?: string;
  }): PaymentTerminal {
    return this.company.createPaymentTerminal(input);
  }

  approvePaymentTerminal(terminalId: string): PaymentTerminal {
    return this.company.approvePaymentTerminal(terminalId);
  }

  async activatePaymentTerminal(tenantId: string, terminalId: string): Promise<PaymentTerminal> {
    return this.company.activatePaymentTerminal(tenantId, terminalId);
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
    return this.company.getCompanyActivationState(companyId);
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
    return this.company.updateCompanyActivationState(companyId, updates);
  }

  getCompanyOnboarding(onboardingId: string): CompanyOnboarding | null {
    return this.company.getCompanyOnboarding(onboardingId);
  }

  getCompanyOnboardingByCompanyId(companyId: string): CompanyOnboarding | null {
    return this.company.getCompanyOnboardingByCompanyId(companyId);
  }

  validateCompanyPlanLimits(
    companyId: string,
    action: 'create_store' | 'create_branch' | 'create_product' | 'create_service' | 'execute_transaction' | 'create_b2b' | 'create_industry' | 'create_hub' | 'create_batch',
    currentCount?: number
  ): { allowed: boolean; reason?: string; soft_block?: boolean } {
    return this.orchestration.validateCompanyPlanLimits(companyId, action, currentCount);
  }

  // --- Collaborations (API explícita; implementação futura) ---

  inviteCollaborator(input: {
    company_id: string;
    actor_id: string;
    role: 'accountant' | 'sales' | 'manager' | 'service_operator';
    invited_by: string;
  }): CompanyCollaborator {
    throw new Error(NOT_IMPLEMENTED_COLLABORATIONS);
  }

  acceptCollaborationInvite(collaborationId: string, actor_id: string): CompanyCollaborator {
    throw new Error(NOT_IMPLEMENTED_COLLABORATIONS);
  }

  declineCollaborationInvite(collaborationId: string, actor_id: string): CompanyCollaborator {
    throw new Error(NOT_IMPLEMENTED_COLLABORATIONS);
  }

  revokeCollaboration(collaborationId: string, revoked_by: string): CompanyCollaborator {
    throw new Error(NOT_IMPLEMENTED_COLLABORATIONS);
  }

  getCompanyCollaborators(
    companyId: string,
    status?: 'invited' | 'accepted' | 'revoked' | 'declined'
  ): CompanyCollaborator[] {
    return [];
  }

  getActorCollaborations(
    actorId: string,
    status?: 'invited' | 'accepted' | 'revoked' | 'declined'
  ): CompanyCollaborator[] {
    return [];
  }

  getCollaboration(collaborationId: string): CompanyCollaborator | null {
    return null;
  }

  getActorCompanyPermissions(companyId: string, actorId: string): string[] {
    return [];
  }
}