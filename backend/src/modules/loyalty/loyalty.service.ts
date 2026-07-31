// backend/src/modules/loyalty/loyalty.service.ts
// SPRINT 93: LOYALTY / FIDELIDADE

import { loyaltyRepository } from './loyalty.repository';
import { loyaltyRuleRepository } from './loyalty-rule.repository';
import { loyaltyVoucherRepository } from './loyalty-voucher.repository';
import { policyRegistry } from '@core/policy/policy-registry';
import type {
  LoyaltyAccount,
  LoyaltyLedgerEntry,
  LoyaltyRule,
  LoyaltyVoucher,
  CreateLoyaltyRuleInput,
  RedeemPointsInput,
  EarnFromPaymentInput,
  LoyaltyLedgerFilters,
  LoyaltyRuleFilters,
} from './loyalty.types';

/**
 * Service para Loyalty / Fidelidade
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Loyalty ≠ dinheiro: pontos NÃO são saldo bancário
 * - Sem ações automáticas irreversíveis
 * - Sem ranking/score social
 * - Regras explícitas e explicáveis
 * - Append-only no ledger de pontos
 * - Resgate não executa pagamento: no máximo cria "voucher"
 * - Tudo auditável
 */
class LoyaltyService {
  async getOrCreateAccount(tenantId: string, contactId: string): Promise<LoyaltyAccount> {
    return await loyaltyRepository.getOrCreateAccount(tenantId, contactId);
  }

  async getBalance(tenantId: string, contactId: string): Promise<number> {
    const account = await loyaltyRepository.getAccountByContact(tenantId, contactId);
    return account?.pointsBalance || 0;
  }

  async listLedger(tenantId: string, filters: LoyaltyLedgerFilters): Promise<LoyaltyLedgerEntry[]> {
    return await loyaltyRepository.listLedger(
      tenantId,
      filters.contactId,
      filters.limit || 50,
      filters.offset || 0
    );
  }

  async listRules(tenantId: string, filters: LoyaltyRuleFilters = {}): Promise<LoyaltyRule[]> {
    return await loyaltyRuleRepository.listRules(tenantId, filters);
  }

  async createRule(tenantId: string, input: CreateLoyaltyRuleInput): Promise<LoyaltyRule> {
    const rule = await loyaltyRuleRepository.createRule(tenantId, input);

    await this.recordAudit(tenantId, {
      eventType: 'LOYALTY_RULE_CREATED',
      ruleId: rule.id,
      name: rule.name,
      ruleType: rule.ruleType,
    });

    return rule;
  }

  async setRuleStatus(tenantId: string, ruleId: string, status: 'ACTIVE' | 'INACTIVE'): Promise<void> {
    await loyaltyRuleRepository.updateRuleStatus(tenantId, ruleId, status);

    await this.recordAudit(tenantId, {
      eventType: 'LOYALTY_RULE_STATUS_CHANGED',
      ruleId,
      status,
    });
  }

  /**
   * Acumula pontos a partir de pagamento SUCCESS
   * 
   * Resolve regras aplicáveis, calcula pontos, aplica caps e cria ledger entry
   */
  async earnFromPaymentSuccess(tenantId: string, input: EarnFromPaymentInput): Promise<{
    pointsEarned: number;
    newBalance: number;
  }> {
    // 1. Verificar se earn está habilitado (policy)
    const earnPolicy = policyRegistry.getPolicyValue<boolean>('loyalty', 'earn_enabled', true);
    if (earnPolicy === false) {
      return { pointsEarned: 0, newBalance: 0 };
    }

    // 2. Buscar ou criar conta
    const account = await this.getOrCreateAccount(tenantId, input.contactId);

    // 3. Resolver regras aplicáveis
    const rules = await loyaltyRuleRepository.getApplicableRules(
      tenantId,
      input.channel,
      input.actorId,
      input.productVariantId,
      input.categoryId
    );

    if (rules.length === 0) {
      return { pointsEarned: 0, newBalance: account.pointsBalance };
    }

    // 4. Calcular pontos por regra
    let totalPoints = 0;
    for (const rule of rules) {
      // Validar min_amount (em centavos)
      if (rule.minAmount != null && input.amountCents < rule.minAmount) {
        continue;
      }

      // Validar valid_from/valid_to
      const now = new Date();
      if (rule.validFrom && now < rule.validFrom) {
        continue;
      }
      if (rule.validTo && now > rule.validTo) {
        continue;
      }

      // Calcular pontos
      let points = 0;
      if (rule.ruleType === 'PERCENT_OF_AMOUNT') {
        points = Math.round(input.amountCents * (rule.valueCents / 100));
      } else if (rule.ruleType === 'FIXED_POINTS') {
        points = Math.round(rule.valueCents);
      }

      totalPoints += points;
    }

    if (totalPoints <= 0) {
      return { pointsEarned: 0, newBalance: account.pointsBalance };
    }

    // 5. Aplicar cap diário (policy)
    const maxDaily = policyRegistry.getPolicyValue<number>('loyalty', 'max_points_per_day', 5000) ?? 5000;

    // Calcular pontos já ganhos hoje
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEntries = await loyaltyRepository.listLedger(tenantId, input.contactId, 1000, 0);
    const todayEarned = todayEntries
      .filter((e) => e.entryType === 'EARN' && (typeof e.createdAt === 'string' ? new Date(e.createdAt) : e.createdAt) >= today)
      .reduce((sum, e) => sum + e.points, 0);

    // Aplicar cap
    const remainingDaily = Math.max(0, maxDaily - todayEarned);
    const finalPoints = Math.min(totalPoints, remainingDaily);

    if (finalPoints <= 0) {
      return { pointsEarned: 0, newBalance: account.pointsBalance };
    }

    // 6. Criar ledger entry (idempotente)
    const { ledgerEntry, newBalance } = await loyaltyRepository.addPoints(
      tenantId,
      input.contactId,
      finalPoints,
      'EARN',
      input.referenceType,
      input.referenceId,
      'PAYMENT_SUCCESS',
      `Pontos ganhos por pagamento de R$ ${(input.amountCents / 100).toFixed(2)}`,
      input.actorId || null,
      null
    );

    await this.recordAudit(tenantId, {
      eventType: 'LOYALTY_EARNED',
      contactId: input.contactId,
      pointsEarned: finalPoints,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      ledgerEntryId: ledgerEntry.id,
    });

    return { pointsEarned: finalPoints, newBalance };
  }

  /**
   * Resgata pontos criando voucher
   */
  async redeemPoints(tenantId: string, input: RedeemPointsInput): Promise<{
    voucher: LoyaltyVoucher;
    newBalance: number;
  }> {
    // 1. Verificar se redeem está habilitado (policy)
    const redeemPolicy = policyRegistry.getPolicyValue<boolean>('loyalty', 'redeem_enabled', true);
    if (redeemPolicy === false) {
      throw new Error('Resgate de pontos está desabilitado');
    }

    // 2. Validar saldo suficiente
    const account = await this.getOrCreateAccount(tenantId, input.contactId);
    if (account.pointsBalance < input.points) {
      throw new Error(`Saldo insuficiente. Disponível: ${account.pointsBalance}, Solicitado: ${input.points}`);
    }

    // 3. Criar ledger entry REDEEM
    const { ledgerEntry, newBalance } = await loyaltyRepository.addPoints(
      tenantId,
      input.contactId,
      input.points,
      'REDEEM',
      'manual',
      null,
      'REDEEM_VOUCHER',
      `Resgate de ${input.points} pontos`,
      null,
      null
    );

    // 4. Criar voucher
    const voucher = await loyaltyVoucherRepository.createVoucher(
      tenantId,
      input.contactId,
      input.voucherType,
      input.valueCents ?? null,
      input.benefitCode || null,
      input.expiresAt || null,
      ledgerEntry.id
    );

    await this.recordAudit(tenantId, {
      eventType: 'LOYALTY_REDEEMED',
      contactId: input.contactId,
      pointsRedeemed: input.points,
      voucherId: voucher.id,
      voucherType: input.voucherType,
      ledgerEntryId: ledgerEntry.id,
    });

    return { voucher, newBalance };
  }

  async listVouchers(tenantId: string, contactId: string, status?: LoyaltyVoucher['status']): Promise<LoyaltyVoucher[]> {
    return await loyaltyVoucherRepository.listVouchers(tenantId, contactId, status);
  }

  private async recordAudit(tenantId: string, data: Record<string, any>): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, {
        event_type: (data.eventType as string) ?? 'LOYALTY_EVENT',
        severity: 'WARNING',
        source: 'impact',
        context: data,
      });
    } catch (error) {
      console.warn('[LoyaltyService] Erro ao registrar auditoria:', error);
    }
  }
}

export const loyaltyService = new LoyaltyService();

