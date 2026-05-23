// backend/src/modules/presence/promo-benefit.service.ts
// SPRINT 94: PRESENÇA + CHECK-IN SOCIAL + BENEFÍCIOS PROMOCIONAIS

import { promoBenefitRepository } from './promo-benefit.repository';
import { loyaltyService } from '../loyalty/loyalty.service';
import { loyaltyVoucherRepository } from '../loyalty/loyalty-voucher.repository';
import { policyRegistry } from '@core/policy/policy-registry';
import type {
  PromoBenefit,
  CreatePromoBenefitInput,
  PresenceContextType,
} from './presence.types';

class PromoBenefitService {
  async createBenefit(tenantId: string, input: CreatePromoBenefitInput): Promise<PromoBenefit> {
    const benefit = await promoBenefitRepository.createBenefit(
      tenantId,
      input.contextType,
      input.contextId,
      input.benefitType,
      input.benefitValue,
      input.requiresCheckin !== undefined ? input.requiresCheckin : true,
      input.maxRedemptions || null,
      input.perContactLimit || 1,
      input.validFrom || null,
      input.validTo || null,
      input.metadata
    );

    await this.recordAudit(tenantId, {
      eventType: 'PROMO_BENEFIT_CREATED',
      benefitId: benefit.id,
      contextType: input.contextType,
      contextId: input.contextId,
      benefitType: input.benefitType,
      benefitValue: input.benefitValue,
    });

    return benefit;
  }

  async listBenefits(
    tenantId: string,
    contextType: PresenceContextType,
    contextId: string
  ): Promise<PromoBenefit[]> {
    return await promoBenefitRepository.listBenefits(tenantId, contextType, contextId);
  }

  /**
   * Aplica benefício promocional quando check-in é feito
   * 
   * ⚠️ REGRAS:
   * - SOMENTE se requires_checkin = true
   * - Dentro da validade (valid_from/valid_to)
   * - Respeita per_contact_limit
   * - Respeita max_redemptions (global)
   * - Idempotente (não aplica duas vezes)
   */
  async applyBenefitOnCheckIn(
    tenantId: string,
    contextType: PresenceContextType,
    contextId: string,
    contactId: string,
    checkinId: string
  ): Promise<number> {
    // 1. Verificar se promo está habilitada (policy)
    const promoEnabled = policyRegistry.getPolicyValue<boolean>('presence', 'promo_enabled', true);
    if (promoEnabled === false) {
      return 0;
    }

    // 2. Buscar benefícios ativos
    const benefits = await promoBenefitRepository.listBenefits(tenantId, contextType, contextId);

    if (benefits.length === 0) {
      return 0;
    }

    let appliedCount = 0;

    for (const benefit of benefits) {
      // Validar requires_checkin
      if (!benefit.requiresCheckin) {
        continue;
      }

      // Validar valid_from/valid_to
      const now = new Date();
      if (benefit.validFrom && now < benefit.validFrom) {
        continue;
      }
      if (benefit.validTo && now > benefit.validTo) {
        continue;
      }

      // Validar per_contact_limit
      const hasRedeemed = await promoBenefitRepository.hasRedeemed(tenantId, benefit.id, contactId);
      if (hasRedeemed) {
        // Verificar se já atingiu o limite
        // Por enquanto, se já resgatou uma vez e per_contact_limit = 1, pular
        if (benefit.perContactLimit <= 1) {
          continue;
        }
        // Futuro: contar quantas vezes já resgatou e comparar com per_contact_limit
      }

      // Validar max_redemptions (global)
      if (benefit.maxRedemptions) {
        const redemptionCount = await promoBenefitRepository.getRedemptionCount(tenantId, benefit.id);
        if (redemptionCount >= benefit.maxRedemptions) {
          continue;
        }
      }

      // Aplicar benefício
      try {
        let loyaltyLedgerId: string | null = null;
        let voucherId: string | null = null;

        if (benefit.benefitType === 'LOYALTY_POINTS') {
          // Acumular pontos adicionais
          const { loyaltyRepository } = await import('../loyalty/loyalty.repository');
          const { ledgerEntry } = await loyaltyRepository.addPoints(
            tenantId,
            contactId,
            Math.round(benefit.benefitValue),
            'EARN',
            'promo_benefit',
            benefit.id,
            'PROMO_CHECKIN',
            `Pontos promocionais por check-in`,
            null,
            null
          );
          loyaltyLedgerId = ledgerEntry.id;
        } else if (benefit.benefitType === 'VOUCHER') {
          // Criar voucher direto (sem debitar pontos)
          const voucher = await loyaltyVoucherRepository.createVoucher(
            tenantId,
            contactId,
            'DISCOUNT_FIXED',
            benefit.benefitValue,
            null,
            null,
            null
          );
          voucherId = voucher.id;
        }
        // LOYALTY_MULTIPLIER: futuro (aplicar multiplicador na próxima compra)

        // Registrar resgate (idempotente)
        await promoBenefitRepository.createRedemption(
          tenantId,
          benefit.id,
          contactId,
          checkinId,
          loyaltyLedgerId,
          voucherId,
          {
            source: 'CHECKIN',
            checkinId,
          }
        );

        appliedCount++;

        await this.recordAudit(tenantId, {
          eventType: 'PROMO_BENEFIT_APPLIED',
          benefitId: benefit.id,
          contactId,
          checkinId,
          benefitType: benefit.benefitType,
          benefitValue: benefit.benefitValue,
        });
      } catch (error) {
        // Log mas continua com outros benefícios
        console.warn(`[PromoBenefitService] Erro ao aplicar benefício ${benefit.id}:`, error);
      }
    }

    return appliedCount;
  }

  private async recordAudit(tenantId: string, data: Record<string, any>): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, {
        event_type: (data.eventType as string) ?? 'PROMO_BENEFIT_EVENT',
        severity: 'medium',
        source: 'impact',
        context: data,
      });
    } catch (error) {
      console.warn('[PromoBenefitService] Erro ao registrar auditoria:', error);
    }
  }
}

export const promoBenefitService = new PromoBenefitService();





