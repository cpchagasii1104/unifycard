// src/modules/events/organizers/organizer-plans.service.ts
// Service para gerenciar planos de organizadores
import { runQueryWithTenant } from '@core/database/pool';

export type OrganizerPlan = 'free' | 'basic' | 'pro' | 'enterprise';

export interface PlanBenefits {
  maxEventsPerMonth: number | null; // null = ilimitado
  feedPriority: 'low' | 'normal' | 'high' | 'premium';
  metricsAccess: 'basic' | 'advanced' | 'full';
  insightsEnabled: boolean;
  customCTAEnabled: boolean;
  analyticsExportEnabled: boolean;
  supportLevel: 'community' | 'email' | 'priority' | 'dedicated';
}

export interface OrganizerPlanInfo {
  plan: OrganizerPlan;
  name: string;
  description: string;
  price: number | null; // null = grátis
  benefits: PlanBenefits;
  recommended?: boolean;
}

export class OrganizerPlansService {
  /**
   * Retorna informações de todos os planos disponíveis
   */
  getAvailablePlans(): OrganizerPlanInfo[] {
    return [
      {
        plan: 'free',
        name: 'Grátis',
        description: 'Ideal para começar',
        price: null,
        benefits: {
          maxEventsPerMonth: 3,
          feedPriority: 'low',
          metricsAccess: 'basic',
          insightsEnabled: false,
          customCTAEnabled: false,
          analyticsExportEnabled: false,
          supportLevel: 'community',
        },
      },
      {
        plan: 'basic',
        name: 'Básico',
        description: 'Para organizadores ativos',
        price: 29.90,
        recommended: true,
        benefits: {
          maxEventsPerMonth: 10,
          feedPriority: 'normal',
          metricsAccess: 'basic',
          insightsEnabled: true,
          customCTAEnabled: false,
          analyticsExportEnabled: false,
          supportLevel: 'email',
        },
      },
      {
        plan: 'pro',
        name: 'Profissional',
        description: 'Para quem quer crescer',
        price: 99.90,
        benefits: {
          maxEventsPerMonth: null, // ilimitado
          feedPriority: 'high',
          metricsAccess: 'advanced',
          insightsEnabled: true,
          customCTAEnabled: true,
          analyticsExportEnabled: true,
          supportLevel: 'priority',
        },
      },
      {
        plan: 'enterprise',
        name: 'Enterprise',
        description: 'Solução completa',
        price: null, // customizado
        benefits: {
          maxEventsPerMonth: null,
          feedPriority: 'premium',
          metricsAccess: 'full',
          insightsEnabled: true,
          customCTAEnabled: true,
          analyticsExportEnabled: true,
          supportLevel: 'dedicated',
        },
      },
    ];
  }

  /**
   * Retorna informações de um plano específico
   */
  getPlanInfo(plan: OrganizerPlan): OrganizerPlanInfo | null {
    return this.getAvailablePlans().find((p) => p.plan === plan) || null;
  }

  /**
   * Retorna benefícios de um plano
   */
  getPlanBenefits(plan: OrganizerPlan): PlanBenefits {
    const planInfo = this.getPlanInfo(plan);
    return planInfo?.benefits || this.getPlanInfo('free')!.benefits;
  }

  /**
   * Verifica se organizador pode criar mais eventos
   */
  async canCreateEvent(
    tenantId: string,
    organizerId: string,
    currentMonth: Date = new Date()
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Buscar plano do organizador
    const organizerRow = await runQueryWithTenant<{
      plan: string;
      plan_expiresAt: Date | null;
    }>(
      tenantId,
      `
      SELECT plan, plan_expiresAt
      FROM event_organizers
      WHERE id = $1
      `,
      [organizerId]
    );

    if (!organizerRow) {
      return { allowed: false, reason: 'Organizador não encontrado' };
    }

    // Verificar se plano expirou
    if (organizerRow.plan_expiresAt && organizerRow.plan_expiresAt < new Date()) {
      return { allowed: false, reason: 'Plano expirado' };
    }

    const plan = organizerRow.plan as OrganizerPlan;
    const benefits = this.getPlanBenefits(plan);

    // Se ilimitado, permitir
    if (benefits.maxEventsPerMonth === null) {
      return { allowed: true };
    }

    // Contar eventos criados no mês atual
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    const eventsCount = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
      SELECT COUNT(*) as count
      FROM events
      WHERE organizer_id = $1
        AND createdAt >= $2
        AND createdAt <= $3
      `,
      [organizerId, monthStart, monthEnd]
    );

    const count = parseInt(eventsCount?.count || '0', 10);

    if (count >= benefits.maxEventsPerMonth) {
      return {
        allowed: false,
        reason: `Limite de ${benefits.maxEventsPerMonth} eventos/mês atingido. Considere fazer upgrade.`,
      };
    }

    return { allowed: true };
  }

  /**
   * Calcula multiplicador de prioridade no feed baseado no plano
   */
  getFeedPriorityMultiplier(plan: OrganizerPlan): number {
    const benefits = this.getPlanBenefits(plan);
    
    switch (benefits.feedPriority) {
      case 'low':
        return 1.0;
      case 'normal':
        return 1.2;
      case 'high':
        return 1.5;
      case 'premium':
        return 2.0;
      default:
        return 1.0;
    }
  }
}

export const organizerPlansService = new OrganizerPlansService();


