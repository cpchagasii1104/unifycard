// backend/src/modules/marketplace/application/services/marketplace-orchestration.service.ts
// Application Service: orquestração — dados estáticos e lógica que ainda vivia na facade.

import type { IncentiveRule, IncentiveGrant, EconomicSustainabilitySnapshot, ServiceGovernanceMetrics } from '@contracts/marketplace';
import { isUseBankRegionalFundEnabled } from '@core/features/use-bank-regional-fund';
import { v5 as uuidv5 } from 'uuid';
import { bankAccountService } from '../../../bank/bank-account.service';
import { bankTransactionService } from '../../../bank/bank-transaction.service';
import { buildSystemAuthorship } from '../../../bank/financial-authorship.helper';
import type { MarketplaceStateAdapter } from '../../state/marketplace-state.adapter';
import {
  REGIONAL_INCENTIVE_REF_NAMESPACE,
  resolveIncentiveRecipientAccountId,
} from '../../marketplace-regional-fund-bank.helpers';

/** Item de inbox de dispatch (tipo local, ex-sub-services/dispatch). Compatível com retorno de getProviderDispatchInbox. */
type DispatchInboxItem = {
  dispatchId: string;
  requestId: string;
  providerActorId?: string;
  serviceId?: string;
  request_summary?: unknown;
  pre_reservation?: unknown;
  status: string;
  createdAt: string;
  expiresAt?: string;
};

/** Perfil de custo operacional legado (actor + period). Uso interno do orchestration. */
export interface LegacyOperationalCostProfile {
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

/** Deps opcionais para métodos que precisam de facade/application services (injetados via init). */
export interface MarketplaceOrchestrationDeps {
  getCompanyPlan(planId: string): {
    capabilities: {
      maxStores?: number;
      maxBranches?: number;
      maxProducts?: number;
      maxServices?: number;
      b2bContractsEnabled?: boolean;
      industryEnabled?: boolean;
      hubEnabled?: boolean;
      batchProductionEnabled?: boolean;
    };
  } | null;
  getCompanyOnboardingByCompanyId(companyId: string): { planId: string } | null;
  /** Opcional: para incentivos */
  regionalActivationService?: {
    getUnlockedIncentive(tenantId: string, region: { country: string; state: string; city: string }): Promise<unknown>;
  };
  economicIdentityService?: {
    getEconomicIdentity(tenantId: string, actorId: string): Promise<{ trustLevel: string } | null>;
  };
  regionalFundService?: {
    getRegionalFundByRegion(tenantId: string, region: { country: string; state: string; city: string }): Promise<{ regionalFundId: string; balance: number } | null>;
    allocateRegionalFund(tenantId: string, input: unknown): Promise<{ status: string; allocation_id: string }>;
    executeAllocation(tenantId: string, allocationId: string): Promise<unknown>;
  };
  marketplaceLogger?: { init(msg: string, meta?: unknown): void; error(msg: string, err: unknown): void };
  recordIncentiveGrantedEvent?: (grant: IncentiveGrant, rule: IncentiveRule) => void;
  /** Opcional: Economic Sustainability */
  economicModule?: {
    getEconomicSustainabilitySnapshots(actorId: string): Array<{ period: { year: number; month: number } }>;
    getLegacyOperationalCostProfile(actorId: string, period: { year: number; month: number }): LegacyOperationalCostProfile | null;
    setEconomicSustainabilitySnapshot(id: string, snapshot: EconomicSustainabilitySnapshot): void;
  };
  getOrdersMap?: () => Map<string, { storeId: string; items: Array<{ price: { amountCents: number }; quantity: number }> }>;
  /** Opcional: Dispatch Governance (inbox, matching priority, metrics) */
  getProviderDispatchInboxRaw?: (providerActorId: string) => DispatchInboxItem[];
  getServiceGovernanceMetricsMap?: () => Map<string, ServiceGovernanceMetrics>;
  /** Preferido: state adapter (visits + quotes). Quando presente, substitui getServiceVisitsMap/getServiceQuotesMap. */
  state?: MarketplaceStateAdapter;
  /** @deprecated Use state.serviceVisits / state.serviceQuotes */
  getServiceVisitsMap?: () => Map<string, { providerActorId: string; visitId: string; createdAt: string; status: string }>;
  /** @deprecated Use state.serviceVisits / state.serviceQuotes */
  getServiceQuotesMap?: () => Map<string, { providerActorId: string; visitId: string; createdAt: string; status: string }>;
  recordOrderEvent?: (event: unknown) => void;
  downgradeTrustLevel?: (actorId: string, reason: string) => void;
}

export class MarketplaceOrchestrationService {
  private _deps?: MarketplaceOrchestrationDeps;

  constructor() {}

  /** Injetar dependências (chamado pela facade no final do constructor). */
  init(deps: MarketplaceOrchestrationDeps): void {
    this._deps = deps;
  }

  /**
   * Validar limites do plano da empresa
   */
  validateCompanyPlanLimits(
    companyId: string,
    action: 'create_store' | 'create_branch' | 'create_product' | 'create_service' | 'execute_transaction' | 'create_b2b' | 'create_industry' | 'create_hub' | 'create_batch',
    currentCount?: number
  ): { allowed: boolean; reason?: string; soft_block?: boolean } {
    const d = this._deps;
    if (!d) {
      return { allowed: true };
    }
    const onboarding = d.getCompanyOnboardingByCompanyId(companyId);
    if (!onboarding) {
      return { allowed: false, reason: 'Empresa não encontrada' };
    }
    const plan = d.getCompanyPlan(onboarding.planId);
    if (!plan) {
      return { allowed: false, reason: 'Plano não encontrado' };
    }
    const caps = plan.capabilities;
    switch (action) {
      case 'create_store':
        if (currentCount !== undefined && caps.maxStores != null && currentCount >= caps.maxStores) {
          return { allowed: false, reason: `Limite de lojas atingido (${caps.maxStores})`, soft_block: true };
        }
        break;
      case 'create_branch':
        if (currentCount !== undefined && caps.maxBranches != null && currentCount >= caps.maxBranches) {
          return { allowed: false, reason: `Limite de filiais atingido (${caps.maxBranches})`, soft_block: true };
        }
        break;
      case 'create_product':
        if (currentCount !== undefined && caps.maxProducts != null && currentCount >= caps.maxProducts) {
          return { allowed: false, reason: `Limite de produtos atingido (${caps.maxProducts})`, soft_block: true };
        }
        break;
      case 'create_service':
        if (currentCount !== undefined && caps.maxServices != null && currentCount >= caps.maxServices) {
          return { allowed: false, reason: `Limite de serviços atingido (${caps.maxServices})`, soft_block: true };
        }
        break;
      case 'create_b2b':
        if (!caps.b2bContractsEnabled) {
          return { allowed: false, reason: 'Contratos B2B não habilitados no plano atual' };
        }
        break;
      case 'create_industry':
        if (!caps.industryEnabled) {
          return { allowed: false, reason: 'Produtos industriais não habilitados no plano atual' };
        }
        break;
      case 'create_hub':
        if (!caps.hubEnabled) {
          return { allowed: false, reason: 'Hubs não habilitados no plano atual' };
        }
        break;
      case 'create_batch':
        if (!caps.batchProductionEnabled) {
          return { allowed: false, reason: 'Lotes de produção não habilitados no plano atual' };
        }
        break;
    }
    return { allowed: true };
  }

  /**
   * Mapear categoria para tipo de ator (usado pelo CompanyApplicationService via orchestrator)
   */
  mapCategoryToActorType(
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

  // ========== INCENTIVOS (estado interno + deps opcionais) ==========
  private incentiveRules: Map<string, IncentiveRule> = new Map();
  private incentiveGrants: IncentiveGrant[] = [];

  async createIncentiveRule(input: {
    tenantId: string;
    region: { country: string; state: string; city: string };
    incentiveType: 'delivery' | 'onboarding' | 'service' | 'logistics';
    maxAmountCents: number;
    maxPerActor: number;
    maxPerPeriod: number;
    requiresTrustLevel: 'L2' | 'L3' | 'L4' | 'L5';
  }): Promise<IncentiveRule> {
    const ra = this._deps?.regionalActivationService;
    const log = this._deps?.marketplaceLogger;
    if (!ra) throw new Error('Orchestration: regionalActivationService not injected');
    const unlockedIncentive = await ra.getUnlockedIncentive(input.tenantId, input.region);
    if (!unlockedIncentive) {
      throw new Error('Região não desbloqueou incentivos via snapshot de impacto');
    }
    const ruleId = `incentive-rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const rule: IncentiveRule = {
      ruleId,
      region: input.region,
      incentiveType: input.incentiveType,
      maxAmountCents: input.maxAmountCents,
      maxPerActor: input.maxPerActor,
      maxPerPeriod: input.maxPerPeriod,
      currency: 'BRL',
      requiresTrustLevel: input.requiresTrustLevel,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    this.incentiveRules.set(ruleId, rule);
    if (log) log.init('Regra de incentivo criada', { ruleId, region: `${input.region.city}, ${input.region.state}`, incentiveType: input.incentiveType });
    return rule;
  }

  async grantIncentive(tenantId: string, input: {
    ruleId: string;
    actorId: string;
    actorType: 'user' | 'store' | 'hub' | 'industry' | 'service_provider';
    amountCents: number;
    reference: { order_id?: string; delivery_id?: string; subscription_id?: string; onboarding_id?: string };
  }): Promise<IncentiveGrant> {
    const rule = this.incentiveRules.get(input.ruleId);
    if (!rule) throw new Error('Regra de incentivo não encontrada');
    if (rule.status !== 'active') throw new Error('Regra de incentivo não está ativa');
    const econ = this._deps?.economicIdentityService;
    const rf = this._deps?.regionalFundService;
    const log = this._deps?.marketplaceLogger;
    const record = this._deps?.recordIncentiveGrantedEvent;
    if (!econ || !rf || !log) throw new Error('Orchestration: incentive deps not injected');
    const identity = await econ.getEconomicIdentity(tenantId, input.actorId);
    if (!identity) throw new Error('Identidade econômica não encontrada para o ator');
    const trustLevels: Record<string, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 };
    const requiredLevel = trustLevels[rule.requiresTrustLevel] ?? 0;
    const actorLevel = trustLevels[identity.trustLevel] ?? 0;
    if (actorLevel < requiredLevel) {
      throw new Error(`Trust level insuficiente. Requerido: ${rule.requiresTrustLevel}, Atual: ${identity.trustLevel}`);
    }
    if (input.amountCents > rule.maxAmountCents) {
      throw new Error(`Valor excede máximo permitido. Máximo: ${rule.maxAmountCents}, Solicitado: ${input.amountCents}`);
    }
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const actorGrants = this.incentiveGrants.filter(g => {
      if (g.actorId !== input.actorId || g.ruleId !== input.ruleId || g.status !== 'consumed') return false;
      const d = new Date(g.grantedAt);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const actorTotal = actorGrants.reduce((s, g) => s + g.amountCents, 0);
    if (actorTotal + input.amountCents > rule.maxPerActor) {
      throw new Error(`Limite por ator excedido. Limite: ${rule.maxPerActor}, Já usado: ${actorTotal}, Solicitado: ${input.amountCents}`);
    }
    const regionGrants = this.incentiveGrants.filter(g => {
      if (g.region.country !== rule.region.country || g.region.state !== rule.region.state || g.region.city !== rule.region.city || g.ruleId !== input.ruleId || g.status !== 'consumed') return false;
      const d = new Date(g.grantedAt);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const regionTotal = regionGrants.reduce((s, g) => s + g.amountCents, 0);
    if (regionTotal + input.amountCents > rule.maxPerPeriod) {
      throw new Error(`Limite por período excedido. Limite: ${rule.maxPerPeriod}, Já usado: ${regionTotal}, Solicitado: ${input.amountCents}`);
    }
    const regionalFund = await rf.getRegionalFundByRegion(tenantId, rule.region);
    if (!regionalFund) throw new Error('Fundo regional não encontrado para a região');
    if (regionalFund.balance < input.amountCents) {
      throw new Error(
        `Fundo regional sem saldo suficiente. Saldo: ${regionalFund.balance}, Solicitado: ${input.amountCents}`
      );
    }
    const grantId = `incentive-grant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const ref = input.reference as { order_id?: string; delivery_id?: string; subscription_id?: string; onboarding_id?: string };
    const grant: IncentiveGrant = {
      grantId,
      ruleId: input.ruleId,
      actorId: input.actorId,
      actorType: input.actorType,
      region: rule.region,
      incentiveType: rule.incentiveType,
      amountCents: input.amountCents,
      currency: rule.currency,
      reference: {
        orderId: ref?.order_id,
        deliveryId: ref?.delivery_id,
        subscriptionId: ref?.subscription_id,
        onboardingId: ref?.onboarding_id,
      },
      status: 'granted',
      grantedAt: new Date().toISOString(),
    };
    this.incentiveGrants.push(grant);
    if (record) record(grant, rule);
    log.init('Incentivo concedido', { grantId, ruleId: input.ruleId, actorId: input.actorId, amountCents: input.amountCents });
    return grant;
  }

  async consumeIncentive(tenantId: string, grantId: string): Promise<void> {
    const grant = this.incentiveGrants.find(g => g.grantId === grantId);
    if (!grant) throw new Error('Grant de incentivo não encontrado');
    if (grant.status !== 'granted') throw new Error(`Grant já foi ${grant.status}`);
    const rule = this.incentiveRules.get(grant.ruleId);
    if (!rule) throw new Error('Regra de incentivo não encontrada');
    const rf = this._deps?.regionalFundService;
    const log = this._deps?.marketplaceLogger;
    if (!rf || !log) throw new Error('Orchestration: incentive deps not injected');

    if (isUseBankRegionalFundEnabled()) {
      const regionalFund = await rf.getRegionalFundByRegion(tenantId, grant.region);
      if (!regionalFund) throw new Error('Fundo regional não encontrado');
      const fromAcc = await bankAccountService.ensureRegionalFundBankAccountForRegion(tenantId, grant.region, 'BRL');
      const toAccountId = await resolveIncentiveRecipientAccountId(tenantId, grant.actorId, 'BRL');
      if (!toAccountId) {
        throw new Error(
          'USE_BANK_REGIONAL_FUND: não foi possível resolver conta Bank do beneficiário (user_wallet ou seller_available). Verifique actors.user_id / actors.company_id.'
        );
      }
      const referenceId = uuidv5(grantId, REGIONAL_INCENTIVE_REF_NAMESPACE);
      const eventId = referenceId;

      // C54: Gate financeiro obrigatório antes de transfer (AUTHORITY_PRECEDENCE §4.1)
      const { requireFinancialRiskClearance } = await import('@modules/risk-identity/risk-financial-gate');
      await requireFinancialRiskClearance(tenantId, {
        actorId: grant.actorId,
        action: 'financial_payout',
        amountCents: grant.amountCents,
      });

      try {
        await bankTransactionService.transfer(tenantId, {
          eventId,
          fromAccountId: fromAcc.accountId,
          toAccountId,
          amountCents: grant.amountCents,
          currency: 'BRL',
          transactionType: 'transfer',
          description: `Incentivo regional (grant ${grantId})`,
          metadata: {
            grant_id: grantId,
            incentive_type: grant.incentiveType,
            regional_fund_row_id: regionalFund.regionalFundId,
            order_id: grant.reference.orderId,
          },
          referenceType: 'regional_fund_incentive',
          referenceId,
          authorship: buildSystemAuthorship({ actingForAccountId: fromAcc.accountId }),
          treasurySource: 'treasury:settlement',
        });
        grant.status = 'consumed';
        (grant as { consumedAt?: string }).consumedAt = new Date().toISOString();
        log.init('Incentivo consumido (Bank)', { grant_id: grantId, amountCents: grant.amountCents, referenceId });
        return;
      } catch (err) {
        log.error('Erro ao consumir incentivo (Bank)', err);
        throw err;
      }
    }

    const regionalFund = await rf.getRegionalFundByRegion(tenantId, grant.region);
    if (!regionalFund) throw new Error('Fundo regional não encontrado');
    try {
      const allocation = await rf.allocateRegionalFund(tenantId, {
        regional_fund_id: regionalFund.regionalFundId,
        type: 'incentive',
        target_actorId: grant.actorId,
        target_actorType: grant.actorType,
        amountCents: grant.amountCents,
        reason: `Incentivo ${grant.incentiveType} para ${grant.actorId}`,
        reference: {
          orderId: grant.reference.orderId,
          delivery_id: grant.reference.deliveryId,
          subscription_id: grant.reference.subscriptionId,
        },
      });
      if (allocation.status === 'approved') {
        await rf.executeAllocation(tenantId, allocation.allocation_id);
      }
      grant.status = 'consumed';
      (grant as { consumedAt?: string }).consumedAt = new Date().toISOString();
      log.init('Incentivo consumido', { grant_id: grantId, amountCents: grant.amountCents });
    } catch (err) {
      log.error('Erro ao consumir incentivo', err);
      throw err;
    }
  }

  async getAvailableIncentives(
    tenantId: string,
    actorId: string,
    region: { country: string; state: string; city: string }
  ): Promise<Array<{
    ruleId: string;
    incentiveType: 'delivery' | 'onboarding' | 'service' | 'logistics';
    maxAmountCents: number;
    maxPerActor: number;
    requires_trust_level: 'L2' | 'L3' | 'L4' | 'L5';
    availableAmountCents: number;
  }>> {
    const ra = this._deps?.regionalActivationService;
    const econ = this._deps?.economicIdentityService;
    if (!ra || !econ) return [];
    const unlockedIncentive = await ra.getUnlockedIncentive(tenantId, region);
    if (!unlockedIncentive) return [];
    const identity = await econ.getEconomicIdentity(tenantId, actorId);
    if (!identity) return [];
    const applicableRules = Array.from(this.incentiveRules.values()).filter(rule => {
      if (rule.status !== 'active') return false;
      if (rule.region.country !== region.country || rule.region.state !== region.state || rule.region.city !== region.city) return false;
      const trustLevels: Record<string, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 };
      const requiredLevel = trustLevels[rule.requiresTrustLevel] ?? 0;
      const actorLevel = trustLevels[identity.trustLevel] ?? 0;
      return actorLevel >= requiredLevel;
    });
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    return applicableRules.map(rule => {
      const actorGrants = this.incentiveGrants.filter(g => {
        if (g.actorId !== actorId || g.ruleId !== rule.ruleId || g.status !== 'consumed') return false;
        const d = new Date(g.grantedAt);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });
      const actorUsed = actorGrants.reduce((s, g) => s + g.amountCents, 0);
      const availableAmountCents = Math.max(0, rule.maxPerActor - actorUsed);
      return {
        ruleId: rule.ruleId,
        incentiveType: rule.incentiveType,
        maxAmountCents: rule.maxAmountCents,
        maxPerActor: rule.maxPerActor,
        requires_trust_level: rule.requiresTrustLevel,
        availableAmountCents: Math.min(availableAmountCents, rule.maxAmountCents),
      };
    });
  }

  // ========== BLOCO 1 — ECONOMIC SUSTAINABILITY ==========

  generateEconomicSustainabilitySnapshot(
    actorId: string,
    period: { year: number; month: number }
  ): EconomicSustainabilitySnapshot {
    const em = this._deps?.economicModule;
    const getOrdersMap = this._deps?.getOrdersMap;
    const log = this._deps?.marketplaceLogger;
    if (!em || !log) throw new Error('Orchestration: economicModule not injected');
    const existingSnapshot = em.getEconomicSustainabilitySnapshots(actorId).find(
      s => s.period.year === period.year && s.period.month === period.month
    );
    if (existingSnapshot) {
      throw new Error(
        `Snapshot já existe para ${actorId} - ${period.month}/${period.year}. Snapshots são imutáveis. Para corrigir, gere um novo período.`
      );
    }
    const profile = em.getLegacyOperationalCostProfile(actorId, period);
    if (!profile) {
      throw new Error('Perfil de custo operacional não encontrado para o período especificado');
    }
    const totalFixedCost = this.calculateTotalFixedCost(profile);
    const averageVariableCost = this.calculateAverageVariableCost(profile);
    const averagePrice = this.calculateAveragePrice(actorId, period, getOrdersMap);
    const breakEvenVolume = this.calculateBreakEvenPoint(totalFixedCost, averagePrice, averageVariableCost);
    const currentMarginPercentage = this.calculateMargin(averagePrice, averageVariableCost);
    const sustainabilityStatus = this.determineSustainabilityStatus(currentMarginPercentage);
    const calculationExplanation = this.generateCalculationExplanation(
      totalFixedCost,
      averageVariableCost,
      averagePrice,
      breakEvenVolume,
      currentMarginPercentage,
      sustainabilityStatus
    );
    const snapshotId = `sustainability-snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const snapshot: EconomicSustainabilitySnapshot = {
      snapshotId,
      actorId,
      actorType: profile.actorType,
      period,
      totalFixedCost,
      averageVariableCost,
      averagePrice,
      breakEvenVolume,
      currentMarginPercentage,
      sustainabilityStatus,
      calculationExplanation,
      currency: profile.currency,
      createdAt: new Date().toISOString(),
    };
    em.setEconomicSustainabilitySnapshot(snapshotId, snapshot);
    log.init('Snapshot de sustentabilidade econômica gerado', { snapshotId, actorId, period: `${period.month}/${period.year}` });
    return snapshot;
  }

  private calculateTotalFixedCost(profile: LegacyOperationalCostProfile): number {
    const c = profile.fixed_costs;
    return (c.rent || 0) + (c.utilities || 0) + (c.internet || 0) + (c.salaries || 0) + (c.taxes || 0) + (c.other || 0);
  }

  private calculateAverageVariableCost(profile: LegacyOperationalCostProfile): number {
    if (profile.variable_costs.length === 0) return 0;
    const total = profile.variable_costs.reduce((sum, vc) => sum + vc.cost_per_unit, 0);
    return total / profile.variable_costs.length;
  }

  private calculateAveragePrice(
    actorId: string,
    period: { year: number; month: number },
    getOrdersMap?: () => Map<string, { storeId: string; items: Array<{ price: { amountCents: number }; quantity: number }> }>
  ): number {
    const startDate = new Date(period.year, period.month - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(period.year, period.month, 0, 23, 59, 59, 999);
    const orderEvents: Array<{ createdAt?: string }> = [];
    const periodOrders = getOrdersMap
      ? Array.from(getOrdersMap().values()).filter(order => {
          if (order.storeId !== actorId) return false;
          if (orderEvents.length === 0) return false;
          const eventDate = new Date(orderEvents[0].createdAt!);
          return eventDate >= startDate && eventDate <= endDate;
        })
      : [];
    if (periodOrders.length === 0) {
      const storesData = this.getStores();
      const store = storesData.stores.find(s => s.storeId === actorId);
      if (store) return 50;
      return 0;
    }
    let totalPrice = 0;
    let totalItems = 0;
    for (const order of periodOrders) {
      for (const item of order.items) {
        totalPrice += item.price.amountCents;
        totalItems += item.quantity;
      }
    }
    return totalItems > 0 ? totalPrice / totalItems : 0;
  }

  private calculateBreakEvenPoint(
    totalFixedCost: number,
    averagePrice: number,
    averageVariableCost: number
  ): number {
    if (averagePrice <= averageVariableCost) return Infinity;
    return Math.ceil(totalFixedCost / (averagePrice - averageVariableCost));
  }

  private calculateMargin(averagePrice: number, averageVariableCost: number): number {
    if (averagePrice === 0) return 0;
    return ((averagePrice - averageVariableCost) / averagePrice) * 100;
  }

  private determineSustainabilityStatus(marginPercentage: number): 'healthy' | 'warning' | 'critical' {
    if (marginPercentage >= 20) return 'healthy';
    if (marginPercentage >= 5) return 'warning';
    return 'critical';
  }

  private generateCalculationExplanation(
    totalFixedCost: number,
    averageVariableCost: number,
    averagePrice: number,
    breakEvenVolume: number,
    currentMarginPercentage: number,
    sustainabilityStatus: 'healthy' | 'warning' | 'critical'
  ): string {
    let statusText = '';
    switch (sustainabilityStatus) {
      case 'healthy':
        statusText = 'Seu negócio está operando com margem saudável (≥20%).';
        break;
      case 'warning':
        statusText = 'Sua margem está abaixo do ideal (5-20%). Considere revisar custos ou preços.';
        break;
      case 'critical':
        statusText = 'Sua margem está crítica (<5%). Risco operacional alto.';
        break;
    }
    return (
      `Custos fixos mensais: ${totalFixedCost.toFixed(2)}. ` +
      `Custo variável médio: ${averageVariableCost.toFixed(2)}. ` +
      `Preço médio praticado: ${averagePrice.toFixed(2)}. ` +
      `Ponto de equilíbrio: ${breakEvenVolume} unidades/mês. ` +
      `Margem atual: ${currentMarginPercentage.toFixed(2)}%. ` +
      statusText
    );
  }

  // ========== BLOCO 2 — DISPATCH GOVERNANCE (inbox, matching, metrics) ==========

  normalizeDispatchInboxStatus(status: string): 'accepted' | 'expired' | 'sent' | 'declined' {
    if (status === 'accepted') return 'accepted';
    if (status === 'expired') return 'expired';
    if (status === 'declined') return 'declined';
    return 'sent';
  }

  getProviderDispatchInbox(providerActorId: string): Array<Record<string, unknown> & { status: 'accepted' | 'expired' | 'sent' | 'declined' }> {
    const getRaw = this._deps?.getProviderDispatchInboxRaw;
    if (!getRaw) return [];
    const inbox = getRaw(providerActorId);
    return inbox.map(item => ({
      ...item,
      status: this.normalizeDispatchInboxStatus(item.status),
    })) as Array<Record<string, unknown> & { status: 'accepted' | 'expired' | 'sent' | 'declined' }>;
  }

  calculateMatchingPriority(providerActorId: string): number {
    const getMap = this._deps?.getServiceGovernanceMetricsMap;
    if (!getMap) return 1.0;
    const metrics = getMap().get(providerActorId);
    if (!metrics) return 1.0;
    let priority = 1.0;
    if (metrics.status === 'warning') priority -= 0.1;
    if (metrics.status === 'sla_violation') priority -= 0.3;
    if (metrics.trustDowngradesCount > 0) priority -= 0.5;
    if (metrics.taxaQuoteToExecution < 20) priority -= 0.2;
    else if (metrics.taxaQuoteToExecution < 50) priority -= 0.1;
    return Math.max(0.0, priority);
  }

  getServiceGovernanceMetrics(providerActorId: string): ServiceGovernanceMetrics | null {
    const getMap = this._deps?.getServiceGovernanceMetricsMap;
    if (!getMap) return null;
    return getMap().get(providerActorId) ?? null;
  }

  /**
   * Calcular métricas de governança para um provider (lógica técnica)
   */
  calculateServiceGovernanceMetrics(
    providerActorId: string,
    startDate: string,
    endDate: string,
    categoryId?: string
  ): ServiceGovernanceMetrics {
    const state = this._deps?.state;
    const getVisits = this._deps?.getServiceVisitsMap;
    const getQuotes = this._deps?.getServiceQuotesMap;
    const getMetricsMap = this._deps?.getServiceGovernanceMetricsMap;
    const log = this._deps?.marketplaceLogger;
    const hasVisits = state ?? getVisits;
    const hasQuotes = state ?? getQuotes;
    if (!hasVisits || !hasQuotes || !getMetricsMap || !log) {
      throw new Error('Orchestration: governance deps (state or getServiceVisitsMap/getServiceQuotesMap, getServiceGovernanceMetricsMap) not injected');
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    const visits = state
      ? Array.from(state.serviceVisits.values()).filter(v => {
          if (v.providerActorId !== providerActorId) return false;
          const visitDate = new Date(v.createdAt);
          return visitDate >= start && visitDate <= end;
        })
      : Array.from(getVisits!().values()).filter(v => {
          if (v.providerActorId !== providerActorId) return false;
          const visitDate = new Date(v.createdAt);
          return visitDate >= start && visitDate <= end;
        });
    const quotes = state
      ? Array.from(state.serviceQuotes.values()).filter(q => {
          if (q.providerActorId !== providerActorId) return false;
          const quoteDate = new Date(q.createdAt);
          return quoteDate >= start && quoteDate <= end;
        })
      : Array.from(getQuotes!().values()).filter(q => {
          if (q.providerActorId !== providerActorId) return false;
          const quoteDate = new Date(q.createdAt);
          return quoteDate >= start && quoteDate <= end;
        });
    const visitas_completadas = visits.filter(v => v.status === 'visit_completed').length;
    const visitas_sem_orcamento = visits.filter(v => {
      const hasQuote = quotes.some(q => q.visitId === v.visitId);
      return !hasQuote && v.status === 'visit_completed';
    }).length;
    const orcamentos_enviados = quotes.length;
    const orcamentos_aceitos = quotes.filter(q => q.status === 'accepted').length;
    const orcamentos_recusados = quotes.filter(q => q.status === 'declined').length;
    const orcamentos_expirados = quotes.filter(q => q.status === 'expired').length;
    const taxa_quote_to_execution = visitas_completadas > 0
      ? (orcamentos_aceitos / visitas_completadas) * 100
      : 0;
    let status: 'healthy' | 'warning' | 'sla_violation' | 'trust_penalty' = 'healthy';
    const taxa_visitas_sem_orcamento = visitas_completadas > 0
      ? (visitas_sem_orcamento / visitas_completadas) * 100
      : 0;
    if (taxa_visitas_sem_orcamento > 30) status = 'warning';
    const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff >= 30 && taxa_visitas_sem_orcamento > 50) status = 'sla_violation';
    const existingMetrics = getMetricsMap().get(providerActorId);
    const warnings_count = existingMetrics?.warningsCount ?? 0;
    const sla_violations_count = existingMetrics?.slaViolationsCount ?? 0;
    const trust_downgrades_count = existingMetrics?.trustDowngradesCount ?? 0;
    const metrics: ServiceGovernanceMetrics = {
      providerActorId,
      categoryId: categoryId,
      period: { startDate, endDate },
      visitasSemOrcamento: visitas_sem_orcamento,
      orcamentosEnviados: orcamentos_enviados,
      orcamentosAceitos: orcamentos_aceitos,
      orcamentosRecusados: orcamentos_recusados,
      orcamentosExpirados: orcamentos_expirados,
      taxaQuoteToExecution: taxa_quote_to_execution,
      status,
      warningsCount: status === 'warning' ? warnings_count + 1 : warnings_count,
      slaViolationsCount: status === 'sla_violation' ? sla_violations_count + 1 : sla_violations_count,
      trustDowngradesCount: trust_downgrades_count,
      calculatedAt: new Date().toISOString(),
      lastWarningAt: status === 'warning' ? new Date().toISOString() : existingMetrics?.lastWarningAt,
      lastSlaViolationAt: status === 'sla_violation' ? new Date().toISOString() : existingMetrics?.lastSlaViolationAt,
      lastTrustDowngradeAt: existingMetrics?.lastTrustDowngradeAt,
    };
    getMetricsMap().set(providerActorId, metrics);
    this.applyGovernancePenalties(providerActorId, metrics);
    return metrics;
  }

  /**
   * Aplicar penalidades de governança (lógica técnica)
   */
  private applyGovernancePenalties(providerActorId: string, metrics: ServiceGovernanceMetrics): void {
    const log = this._deps?.marketplaceLogger;
    const recordOrderEvent = this._deps?.recordOrderEvent;
    const downgradeTrustLevel = this._deps?.downgradeTrustLevel;
    const getMetricsMap = this._deps?.getServiceGovernanceMetricsMap;
    if (!log || !getMetricsMap) return;
    if (metrics.status === 'warning' && metrics.warningsCount === 1) {
      log.init('Warning de governança aplicado', {
        providerActorId,
        taxa_visitas_sem_orcamento: metrics.visitasSemOrcamento,
      });
    }
    if (metrics.status === 'sla_violation') {
      try {
        if (recordOrderEvent) {
          recordOrderEvent({
            actorId: providerActorId,
            eventType: 'service_governance_sla_violation',
            metadata: {
              visitas_sem_orcamento: metrics.visitasSemOrcamento,
              taxa_visitas_sem_orcamento: metrics.orcamentosEnviados + metrics.visitasSemOrcamento > 0
                ? (metrics.visitasSemOrcamento / (metrics.orcamentosEnviados + metrics.visitasSemOrcamento)) * 100
                : 0,
            },
          });
        }
      } catch {
        // Ignorar
      }
      log.init('SLA violation de governança registrada', {
        providerActorId,
        sla_violations_count: metrics.slaViolationsCount,
      });
    }
    if (metrics.slaViolationsCount >= 2 && metrics.status === 'sla_violation') {
      try {
        if (downgradeTrustLevel) {
          downgradeTrustLevel(providerActorId, 'service_governance_recurring_violation');
          const updated: ServiceGovernanceMetrics = {
            ...metrics,
            trustDowngradesCount: metrics.trustDowngradesCount + 1,
            lastTrustDowngradeAt: new Date().toISOString(),
          };
          getMetricsMap().set(providerActorId, updated);
          log.init('Trust downgrade aplicado por governança', {
            providerActorId,
            trust_downgrades_count: updated.trustDowngradesCount,
          });
          return;
        }
      } catch {
        // Ignorar
      }
      log.init('Trust downgrade aplicado por governança', {
        providerActorId,
        trust_downgrades_count: metrics.trustDowngradesCount,
      });
    }
  }

  /**
   * Health check do módulo Marketplace
   */
  getHealth(): { domain: string; status: string; version: string } {
    return {
      domain: 'marketplace',
      status: 'active',
      version: 'v0',
    };
  }

  /**
   * Vitrine/Home do Marketplace — estrutura estática e cacheável
   */
  getHome(): {
    domain: string;
    version: string;
    sections: Array<{
      id: string;
      title: string;
      type: string;
      order: number;
    }>;
  } {
    return {
      domain: 'marketplace',
      version: 'v0',
      sections: [
        { id: 'featured', title: 'Destaques', type: 'featured', order: 1 },
        { id: 'supermarket', title: 'Supermercado', type: 'supermarket', order: 2 },
        { id: 'pharmacy', title: 'Farmácia', type: 'pharmacy', order: 3 },
        { id: 'construction', title: 'Construção', type: 'construction', order: 4 },
      ],
    };
  }

  /**
   * Templates de Loja do Marketplace — contratos canônicos estáticos
   */
  getTemplates(): {
    domain: string;
    version: string;
    templates: Array<{
      id: string;
      name: string;
      description: string;
      supports: Array<'unit' | 'weight' | 'fraction' | 'listing'>;
      features: string[];
    }>;
  } {
    return {
      domain: 'marketplace',
      version: 'v0',
      templates: [
        {
          id: 'supermarket',
          name: 'Supermercado',
          description: 'Template para lojas de supermercado com produtos por unidade, peso e fração',
          supports: ['unit', 'weight', 'fraction'],
          features: ['inventory_tracking', 'price_per_unit', 'price_per_weight', 'barcode_scanning', 'expiry_date_tracking', 'promotions'],
        },
        {
          id: 'pharmacy',
          name: 'Farmácia',
          description: 'Template para farmácias com controle de medicamentos e produtos por unidade',
          supports: ['unit', 'fraction'],
          features: ['inventory_tracking', 'prescription_required', 'batch_tracking', 'expiry_date_tracking', 'regulatory_compliance'],
        },
        {
          id: 'construction',
          name: 'Construção',
          description: 'Template para lojas de materiais de construção com produtos por unidade e peso',
          supports: ['unit', 'weight', 'fraction'],
          features: ['inventory_tracking', 'bulk_pricing', 'delivery_scheduling', 'project_management'],
        },
        {
          id: 'general_store',
          name: 'Loja Geral',
          description: 'Template genérico para lojas com produtos diversos por unidade',
          supports: ['unit'],
          features: ['inventory_tracking', 'price_per_unit', 'promotions'],
        },
        {
          id: 'marketplace_listing',
          name: 'Marketplace Listing',
          description: 'Template para anúncios e listagens sem controle de estoque',
          supports: ['listing'],
          features: ['product_listing', 'image_gallery', 'contact_information'],
        },
      ],
    };
  }

  /**
   * Regiões de Descoberta do Marketplace
   * Contrato declarativo de escopos geográficos para filtragem
   */
  getRegions(): {
    domain: string;
    version: string;
    region_scopes: Array<{ id: string; label: string; filters: string[] }>;
    default_scope: string;
  } {
    return {
      domain: 'marketplace',
      version: 'v0',
      default_scope: 'city',
      region_scopes: [
        { id: 'city', label: 'Cidade', filters: ['city'] },
        { id: 'metro', label: 'Região Metropolitana', filters: ['city', 'metro_area'] },
        { id: 'state', label: 'Estado', filters: ['state', 'city'] },
        { id: 'country', label: 'País', filters: ['country', 'state', 'city'] },
        { id: 'neighborhood', label: 'Bairro', filters: ['neighborhood', 'city'] },
      ],
    };
  }

  /**
   * Categorias de Produto do Marketplace
   * Estrutura hierárquica para navegação e descoberta
   */
  getCategories(): {
    domain: string;
    version: string;
    categories: Array<{
      id: string;
      name: string;
      templates: string[];
      children?: Array<{ id: string; name: string; templates: string[] }>;
    }>;
  } {
    return {
      domain: 'marketplace',
      version: 'v0',
      categories: [
        {
          id: 'food-beverages',
          name: 'Alimentos e Bebidas',
          templates: ['supermarket', 'general_store'],
          children: [
            { id: 'food-beverages-fresh', name: 'Produtos Frescos', templates: ['supermarket'] },
            { id: 'food-beverages-packaged', name: 'Produtos Embalados', templates: ['supermarket', 'general_store'] },
            { id: 'food-beverages-beverages', name: 'Bebidas', templates: ['supermarket', 'general_store'] },
            { id: 'food-beverages-frozen', name: 'Congelados', templates: ['supermarket'] },
          ],
        },
        {
          id: 'health-beauty',
          name: 'Saúde e Beleza',
          templates: ['pharmacy', 'general_store'],
          children: [
            { id: 'health-beauty-medicines', name: 'Medicamentos', templates: ['pharmacy'] },
            { id: 'health-beauty-personal-care', name: 'Cuidados Pessoais', templates: ['pharmacy', 'general_store'] },
            { id: 'health-beauty-cosmetics', name: 'Cosméticos', templates: ['pharmacy', 'general_store'] },
            { id: 'health-beauty-vitamins', name: 'Vitaminas e Suplementos', templates: ['pharmacy'] },
          ],
        },
        {
          id: 'home-construction',
          name: 'Casa e Construção',
          templates: ['construction', 'general_store'],
          children: [
            { id: 'home-construction-materials', name: 'Materiais de Construção', templates: ['construction'] },
            { id: 'home-construction-tools', name: 'Ferramentas', templates: ['construction', 'general_store'] },
            { id: 'home-construction-home-decor', name: 'Decoração', templates: ['general_store'] },
            { id: 'home-construction-plumbing', name: 'Encanamento', templates: ['construction'] },
            { id: 'home-construction-electrical', name: 'Elétrica', templates: ['construction'] },
          ],
        },
        {
          id: 'electronics',
          name: 'Eletrônicos',
          templates: ['general_store', 'marketplace_listing'],
          children: [
            { id: 'electronics-mobile', name: 'Celulares e Acessórios', templates: ['general_store', 'marketplace_listing'] },
            { id: 'electronics-computers', name: 'Computadores', templates: ['general_store', 'marketplace_listing'] },
            { id: 'electronics-audio', name: 'Áudio', templates: ['general_store', 'marketplace_listing'] },
            { id: 'electronics-home-appliances', name: 'Eletrodomésticos', templates: ['general_store', 'marketplace_listing'] },
          ],
        },
        {
          id: 'clothing-accessories',
          name: 'Roupas e Acessórios',
          templates: ['general_store', 'marketplace_listing'],
          children: [
            { id: 'clothing-accessories-men', name: 'Masculino', templates: ['general_store', 'marketplace_listing'] },
            { id: 'clothing-accessories-women', name: 'Feminino', templates: ['general_store', 'marketplace_listing'] },
            { id: 'clothing-accessories-kids', name: 'Infantil', templates: ['general_store', 'marketplace_listing'] },
            { id: 'clothing-accessories-shoes', name: 'Calçados', templates: ['general_store', 'marketplace_listing'] },
          ],
        },
        {
          id: 'sports-leisure',
          name: 'Esportes e Lazer',
          templates: ['general_store', 'marketplace_listing'],
          children: [
            { id: 'sports-leisure-fitness', name: 'Fitness', templates: ['general_store', 'marketplace_listing'] },
            { id: 'sports-leisure-outdoor', name: 'Ar Livre', templates: ['general_store', 'marketplace_listing'] },
            { id: 'sports-leisure-sports-equipment', name: 'Equipamentos Esportivos', templates: ['general_store', 'marketplace_listing'] },
          ],
        },
        {
          id: 'books-media',
          name: 'Livros e Mídia',
          templates: ['general_store', 'marketplace_listing'],
          children: [
            { id: 'books-media-books', name: 'Livros', templates: ['general_store', 'marketplace_listing'] },
            { id: 'books-media-music', name: 'Música', templates: ['general_store', 'marketplace_listing'] },
            { id: 'books-media-movies', name: 'Filmes e Séries', templates: ['general_store', 'marketplace_listing'] },
          ],
        },
        {
          id: 'automotive',
          name: 'Automotivo',
          templates: ['general_store', 'marketplace_listing'],
          children: [
            { id: 'automotive-parts', name: 'Peças', templates: ['general_store', 'marketplace_listing'] },
            { id: 'automotive-accessories', name: 'Acessórios', templates: ['general_store', 'marketplace_listing'] },
            { id: 'automotive-maintenance', name: 'Manutenção', templates: ['general_store', 'marketplace_listing'] },
          ],
        },
      ],
    };
  }

  /**
   * Lojas e Filiais do Marketplace
   * READ-ONLY, estático e declarativo
   */
  getStores(scope?: string, valueCents?: string): {
    domain: string;
    version: string;
    scope_applied?: { scope: string; valueCents: string; filter_field: string };
    stores: Array<{
      storeId: string;
      name: string;
      templateId: string;
      location?: {
        country: string;
        state: string;
        city: string;
        neighborhood?: string;
        latitude?: number;
        longitude?: number;
        visible_in_locator: boolean;
      };
      branches: Array<{
        branch_id: string;
        name: string;
        city: string;
        location?: {
          country: string;
          state: string;
          city: string;
          neighborhood?: string;
          latitude?: number;
          longitude?: number;
          visible_in_locator: boolean;
        };
        pickup: boolean;
        delivery: boolean;
      }>;
    }>;
  } {
    const allStores = [
      {
        storeId: 'store-001',
        name: 'Supermercado Central',
        templateId: 'supermarket',
        location: { country: 'Brasil', state: 'SP', city: 'São Paulo', visible_in_locator: true },
        branches: [
          { branch_id: 'branch-001', name: 'Matriz - Centro', city: 'São Paulo', location: { country: 'Brasil', state: 'SP', city: 'São Paulo', neighborhood: 'Centro', visible_in_locator: true }, pickup: true, delivery: true },
          { branch_id: 'branch-002', name: 'Filial - Zona Norte', city: 'São Paulo', location: { country: 'Brasil', state: 'SP', city: 'São Paulo', neighborhood: 'Zona Norte', visible_in_locator: true }, pickup: true, delivery: true },
        ],
      },
      {
        storeId: 'store-002',
        name: 'Farmácia Saúde',
        templateId: 'pharmacy',
        location: { country: 'Brasil', state: 'RJ', city: 'Rio de Janeiro', visible_in_locator: true },
        branches: [
          { branch_id: 'branch-003', name: 'Loja Principal', city: 'Rio de Janeiro', location: { country: 'Brasil', state: 'RJ', city: 'Rio de Janeiro', neighborhood: 'Copacabana', visible_in_locator: true }, pickup: true, delivery: false },
        ],
      },
      {
        storeId: 'store-003',
        name: 'Materiais Construção Ltda',
        templateId: 'construction',
        location: { country: 'Brasil', state: 'MG', city: 'Belo Horizonte', visible_in_locator: true },
        branches: [
          { branch_id: 'branch-004', name: 'Depósito Central', city: 'Belo Horizonte', location: { country: 'Brasil', state: 'MG', city: 'Belo Horizonte', neighborhood: 'Centro', visible_in_locator: true }, pickup: true, delivery: true },
          { branch_id: 'branch-005', name: 'Filial - Zona Sul', city: 'Belo Horizonte', location: { country: 'Brasil', state: 'MG', city: 'Belo Horizonte', neighborhood: 'Zona Sul', visible_in_locator: true }, pickup: true, delivery: false },
        ],
      },
      {
        storeId: 'store-004',
        name: 'Loja Variedades',
        templateId: 'general_store',
        location: { country: 'Brasil', state: 'PR', city: 'Curitiba', visible_in_locator: true },
        branches: [
          { branch_id: 'branch-006', name: 'Loja Única', city: 'Curitiba', location: { country: 'Brasil', state: 'PR', city: 'Curitiba', neighborhood: 'Centro', visible_in_locator: true }, pickup: true, delivery: true },
        ],
      },
      {
        storeId: 'store-005',
        name: 'Anúncios Classificados',
        templateId: 'marketplace_listing',
        location: { country: 'Brasil', state: 'BR', city: 'Brasil', visible_in_locator: false },
        branches: [
          { branch_id: 'branch-007', name: 'Online', city: 'Brasil', location: { country: 'Brasil', state: 'BR', city: 'Brasil', visible_in_locator: false }, pickup: false, delivery: false },
        ],
      },
    ];

    if (scope && valueCents) {
      const regions = this.getRegions();
      const scopeDefinition = regions.region_scopes.find(s => s.id === scope);
      if (scopeDefinition) {
        const filterField = scopeDefinition.filters.includes('city') ? 'city' : null;
        if (filterField) {
          const filteredStores = allStores.map(store => ({
            ...store,
            branches: store.branches.filter(branch => {
              if (filterField === 'city') {
                return branch.city.toLowerCase() === valueCents.toLowerCase();
              }
              return false;
            }),
          })).filter(store => store.branches.length > 0);
          return {
            domain: 'marketplace',
            version: 'v0',
            scope_applied: { scope, valueCents, filter_field: filterField },
            stores: filteredStores,
          };
        }
      }
    }

    return { domain: 'marketplace', version: 'v0', stores: allStores };
  }
}