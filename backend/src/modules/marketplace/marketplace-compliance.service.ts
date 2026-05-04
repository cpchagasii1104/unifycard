// backend/src/modules/marketplace/marketplace.service.compliance.ts
// Módulo Compliance / Risk / Governance — validações, governança de serviços, risco operacional, elegibilidade

import type { MarketplaceService } from './marketplace.service';
import type {
  ServiceGovernanceMetrics,
  OperationalRiskLevel,
  BreakEvenAnalysis,
  RealOperationMetrics,
  ServiceMarginAnalysis,
  ExpansionUnlockFeature,
} from '@contracts/marketplace';
import { marketplaceLogger } from './marketplace.logger';
import type { MarketplaceStateAdapter } from './state/marketplace-state.adapter';

type FacadeWithGovernanceHooks = MarketplaceService & {
  recordOrderEvent?(input: { actorId: string; eventType: string; metadata?: Record<string, unknown> }): void;
  downgradeTrustLevel?(actorId: string, reason: string): void;
};

export class MarketplaceComplianceModule {
  private readonly serviceGovernanceMetrics: Map<string, ServiceGovernanceMetrics> = new Map();

  constructor(
    private readonly facade: MarketplaceService,
    private readonly state: MarketplaceStateAdapter
  ) {}

  getServiceGovernanceMetricsMap(): Map<string, ServiceGovernanceMetrics> {
    return this.serviceGovernanceMetrics;
  }

  calculateServiceGovernanceMetrics(
    providerActorId: string,
    startDate: string,
    endDate: string,
    categoryId?: string
  ): ServiceGovernanceMetrics {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const visits = Array.from(this.state.serviceVisits.values()).filter(v => {
      if (v.providerActorId !== providerActorId) return false;
      const visitDate = new Date(v.createdAt);
      return visitDate >= start && visitDate <= end;
    });

    const quotes = Array.from(this.state.serviceQuotes.values()).filter(q => {
      if (q.providerActorId !== providerActorId) return false;
      const quoteDate = new Date(q.createdAt);
      return quoteDate >= start && quoteDate <= end;
    });

    const visitas_completadas = visits.filter(v => v.status === 'visit_completed').length;
    const visitas_sem_orcamento = visits.filter(v => {
      const hasQuote = quotes.some(qu => qu.visitId === v.visitId);
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

    if (taxa_visitas_sem_orcamento > 30) {
      status = 'warning';
    }

    const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff >= 30 && taxa_visitas_sem_orcamento > 50) {
      status = 'sla_violation';
    }

    const existingMetrics = this.serviceGovernanceMetrics.get(providerActorId);
    const warnings_count = existingMetrics?.warningsCount ?? 0;
    const sla_violations_count = existingMetrics?.slaViolationsCount ?? 0;
    const trust_downgrades_count = existingMetrics?.trustDowngradesCount ?? 0;

    const metrics: ServiceGovernanceMetrics = {
      providerActorId,
      categoryId,
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

    this.serviceGovernanceMetrics.set(providerActorId, metrics);
    this.applyGovernancePenalties(providerActorId, metrics);

    return metrics;
  }

  private applyGovernancePenalties(providerActorId: string, metrics: ServiceGovernanceMetrics): void {
    if (metrics.status === 'warning' && metrics.warningsCount === 1) {
      marketplaceLogger.init('Warning de governança aplicado', {
        providerActorId,
        taxa_visitas_sem_orcamento: metrics.visitasSemOrcamento,
      });
    }

    if (metrics.status === 'sla_violation') {
      try {
        if (typeof this.facade.governance.recordOrderEvent === 'function') {
          this.facade.governance.recordOrderEvent({
            orderId: '',
            actorId: providerActorId,
            actorType: 'service_provider',
            eventType: 'service_governance_sla_violation' as any,
          });
        }
      } catch {
        // Ignorar se método não existir
      }

      marketplaceLogger.init('SLA violation de governança registrada', {
        providerActorId,
        sla_violations_count: metrics.slaViolationsCount,
      });
    }

    if (metrics.slaViolationsCount >= 2 && metrics.status === 'sla_violation') {
      try {
        const facadeWithHooks = this.facade as FacadeWithGovernanceHooks;
        if (typeof facadeWithHooks.downgradeTrustLevel === 'function') {
          facadeWithHooks.downgradeTrustLevel(providerActorId, 'service_governance_recurring_violation');
          metrics.trustDowngradesCount += 1;
          metrics.lastTrustDowngradeAt = new Date().toISOString();
          this.serviceGovernanceMetrics.set(providerActorId, metrics);
        }
      } catch {
        // Ignorar se método não existir
      }

      marketplaceLogger.init('Trust downgrade aplicado por governança', {
        providerActorId,
        trust_downgrades_count: metrics.trustDowngradesCount,
      });
    }
  }

  getServiceGovernanceMetrics(providerActorId: string): ServiceGovernanceMetrics | null {
    return this.serviceGovernanceMetrics.get(providerActorId) ?? null;
  }

  calculateMatchingPriority(providerActorId: string): number {
    const metrics = this.serviceGovernanceMetrics.get(providerActorId);
    if (!metrics) {
      return 1.0;
    }

    let priority = 1.0;
    if (metrics.status === 'warning') priority -= 0.1;
    if (metrics.status === 'sla_violation') priority -= 0.3;
    if (metrics.trustDowngradesCount > 0) priority -= 0.5;
    if (metrics.taxaQuoteToExecution < 20) priority -= 0.2;
    else if (metrics.taxaQuoteToExecution < 50) priority -= 0.1;

    return Math.max(0.0, priority);
  }

  calculateOperationalRisk(
    breakEven: BreakEvenAnalysis,
    operationMetrics: RealOperationMetrics,
    serviceMargins: ServiceMarginAnalysis[]
  ): { risk: OperationalRiskLevel; factors: string[] } {
    const factors: string[] = [];

    if (!breakEven.isAboveBreakEven) {
      factors.push('Operando abaixo do ponto de equilíbrio');
    }
    if (operationMetrics.cancellationRate > 0.3) {
      factors.push(`Taxa de cancelamento alta (${Math.round(operationMetrics.cancellationRate * 100)}%)`);
    }
    const unprofitableServices = serviceMargins.filter(m => !m.isProfitable).length;
    if (unprofitableServices > 0) {
      factors.push(`${unprofitableServices} serviço(s) executado(s) no prejuízo`);
    }
    const avgMargin = serviceMargins.length > 0
      ? serviceMargins.reduce((sum, m) => sum + m.marginPercentage, 0) / serviceMargins.length
      : 0;
    if (avgMargin < 10) {
      factors.push(`Margem média baixa (${Math.round(avgMargin)}%)`);
    }

    let risk: OperationalRiskLevel = 'low';
    if (factors.length >= 3 || !breakEven.isAboveBreakEven) {
      risk = 'high';
    } else if (factors.length >= 2 || operationMetrics.cancellationRate > 0.2) {
      risk = 'medium';
    }

    return { risk, factors };
  }

  getEligibilityCriteria(feature: ExpansionUnlockFeature): string[] {
    switch (feature) {
      case 'facilitated_onboarding':
        return ['Empresa na região afetada', 'Categoria de serviço compatível', 'Trust level >= L2'];
      case 'economic_incentive':
        return ['Novo prestador na região', 'Categoria de serviço compatível', 'Trust level >= L2'];
      case 'service_catalog_suggestion':
        return ['Empresa ativa na região', 'Categoria de serviço compatível'];
      case 'b2b_capacity_market':
        return ['Empresa com capacidade disponível', 'Região compatível'];
      case 'strategic_vouchers':
        return ['Empresa na região afetada', 'Categoria de serviço compatível'];
      default:
        return [];
    }
  }
}