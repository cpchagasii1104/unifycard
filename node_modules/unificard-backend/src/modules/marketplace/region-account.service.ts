// backend/src/modules/marketplace/region-account.service.ts
// SPRINT 77: SETTLEMENT REGIONAL + UNIFYBANK CORE

import { regionAccountRepository } from './region-account.repository';
import type {
  RegionAccount,
  CreditRegionAccountInput,
  DebitRegionAccountInput,
} from './settlement.types';

/**
 * Service para Region Accounts
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - RegionAccount ≠ BankAccount
 * - Tudo explícito e auditável
 * - Nada automático sem ação explícita
 */
class RegionAccountService {
  /**
   * Busca ou cria conta regional
   */
  async getAccount(
    tenantId: string,
    regionId: string,
    currency: string = 'BRL'
  ): Promise<RegionAccount> {
    return await regionAccountRepository.getOrCreateAccount(tenantId, regionId, currency);
  }

  /**
   * Credita valor na conta regional
   */
  async credit(
    tenantId: string,
    regionId: string,
    input: CreditRegionAccountInput,
    creditedByActorId: string,
    creditedByUserId?: string
  ): Promise<RegionAccount> {
    if (input.amountCents <= 0) {
      throw new Error('amountCents deve ser maior que zero');
    }

    const currency = input.currency || 'BRL';

    // Buscar ou criar conta
    await regionAccountRepository.getOrCreateAccount(tenantId, regionId, currency);

    // Creditar
    const account = await regionAccountRepository.credit(
      tenantId,
      regionId,
      input.amountCents,
      currency
    );

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'REGION_ACCOUNT_CREDITED',
      regionId,
      amountCents: input.amountCents,
      currency,
      creditedByActorId,
      creditedByUserId,
      metadata: input.metadata,
    });

    return account;
  }

  /**
   * Debita valor da conta regional
   */
  async debit(
    tenantId: string,
    regionId: string,
    input: DebitRegionAccountInput,
    debitedByActorId: string,
    debitedByUserId?: string
  ): Promise<RegionAccount> {
    if (input.amountCents <= 0) {
      throw new Error('amountCents deve ser maior que zero');
    }

    const currency = input.currency || 'BRL';

    // Debitar
    const account = await regionAccountRepository.debit(
      tenantId,
      regionId,
      input.amountCents,
      currency
    );

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'REGION_ACCOUNT_DEBITED',
      regionId,
      amountCents: input.amountCents,
      currency,
      debitedByActorId,
      debitedByUserId,
      metadata: input.metadata,
    });

    return account;
  }

  private async recordAudit(
    tenantId: string,
    data: {
      eventType: string;
      regionId: string;
      amountCents: number;
      currency: string;
      creditedByActorId?: string;
      creditedByUserId?: string | null;
      debitedByActorId?: string;
      debitedByUserId?: string | null;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, {
        event_type: data.eventType,
        severity: 'MEDIUM',
        actor_id: data.creditedByActorId || data.debitedByActorId || null,
        actor_type: 'user',
        source: 'region_accounts',
        context: {
          region_id: data.regionId,
          amount_cents: data.amountCents,
          currency: data.currency,
          credited_by_actor_id: data.creditedByActorId,
          credited_by_user_id: data.creditedByUserId,
          debited_by_actor_id: data.debitedByActorId,
          debited_by_user_id: data.debitedByUserId,
          metadata: data.metadata,
        },
      });
    } catch (error) {
      console.warn('[RegionAccount] Erro ao registrar auditoria:', error);
    }
  }
}

export const regionAccountService = new RegionAccountService();





