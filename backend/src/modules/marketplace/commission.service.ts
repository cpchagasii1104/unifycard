// backend/src/modules/marketplace/commission.service.ts
// SPRINT 74: GROUPS, INDICAÇÕES E COMISSÕES

import { commissionRepository } from './commission.repository';
import type {
  CommissionRule,
  CreateCommissionRuleInput,
  CommissionCalculationContext,
  CommissionCalculation,
} from './commission.types';

/**
 * Service para Comissões
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Comissão ≠ Split
 * - Comissão ≠ Payout
 * - Comissão ≠ Ledger
 * - Tudo declarativo e auditável
 * - Snapshot imutável no metadata
 * - Nenhuma execução de pagamentos
 */
class CommissionService {
  async createRule(
    tenantId: string,
    input: CreateCommissionRuleInput,
    createdByActorId: string,
    createdByUserId?: string
  ): Promise<CommissionRule> {
    const rule = await commissionRepository.createRule(tenantId, {
      appliesTo: input.appliesTo,
      appliesId: input.appliesId,
      basePercentage: input.basePercentage || 0,
      regionalPercentage: input.regionalPercentage || 0,
      platformPercentage: input.platformPercentage || 0,
      createdByActorId,
      createdByUserId: createdByUserId || null,
      metadata: input.metadata || {},
    });

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'COMMISSION_RULE_CREATED',
      ruleId: rule.id,
      createdByActorId,
      createdByUserId,
    });

    return rule;
  }

  /**
   * Resolve comissão para um contexto
   * 
   * SPRINT 74: Retorna SOMENTE cálculo, nunca execução
   */
  async resolveCommission(
    tenantId: string,
    context: CommissionCalculationContext
  ): Promise<CommissionCalculation> {
    let rule: CommissionRule | null = null;
    let appliesTo: CommissionCalculation['appliesTo'] = null;
    let appliesId: string | null = null;

    // Prioridade: REFERRAL > GROUP > PAYMENT_METHOD
    if (context.referralCodeId) {
      rule = await commissionRepository.findRuleByApplies(tenantId, 'REFERRAL', context.referralCodeId);
      if (rule) {
        appliesTo = 'REFERRAL';
        appliesId = context.referralCodeId;
      }
    }

    if (!rule && context.groupId) {
      rule = await commissionRepository.findRuleByApplies(tenantId, 'GROUP', context.groupId);
      if (rule) {
        appliesTo = 'GROUP';
        appliesId = context.groupId;
      }
    }

    if (!rule && context.paymentMethodId) {
      rule = await commissionRepository.findRuleByApplies(tenantId, 'PAYMENT_METHOD', context.paymentMethodId);
      if (rule) {
        appliesTo = 'PAYMENT_METHOD';
        appliesId = context.paymentMethodId;
      }
    }

    // Calcular valores (declarativo, não executado)
    const baseAmountCents = rule
      ? Math.round(context.amountCents * rule.basePercentage)
      : 0;
    const regionalAmountCents = rule
      ? Math.round(context.amountCents * rule.regionalPercentage)
      : 0;
    const platformAmountCents = rule
      ? Math.round(context.amountCents * rule.platformPercentage)
      : 0;
    const totalAmountCents = baseAmountCents + regionalAmountCents + platformAmountCents;

    return {
      baseAmountCents,
      regionalAmountCents,
      platformAmountCents,
      totalAmountCents,
      ruleId: rule?.id || null,
      appliesTo,
      appliesId,
      snapshot: {
        amount_cents: context.amountCents,
        base_percentage: rule?.basePercentage || 0,
        regional_percentage: rule?.regionalPercentage || 0,
        platform_percentage: rule?.platformPercentage || 0,
        base_amount_cents: baseAmountCents,
        regional_amount_cents: regionalAmountCents,
        platform_amount_cents: platformAmountCents,
        total_amount_cents: totalAmountCents,
        rule_id: rule?.id || null,
        applies_to: appliesTo,
        applies_id: appliesId,
        calculatedAt: new Date().toISOString(),
      },
    };
  }

  private async recordAudit(
    tenantId: string,
    data: {
      eventType: string;
      ruleId: string;
      createdByActorId: string;
      createdByUserId?: string | null;
    }
  ): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, {
        event_type: data.eventType,
        severity: 'INFO',
        actor_id: data.createdByActorId,
        actor_type: 'user',
        source: 'validation',
        context: {
          rule_id: data.ruleId,
          created_by_user_id: data.createdByUserId,
        },
      });
    } catch (error) {
      console.warn('[Commission] Erro ao registrar auditoria:', error);
    }
  }
}

export const commissionService = new CommissionService();







