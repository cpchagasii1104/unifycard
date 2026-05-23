// src/modules/bank/adapters/bank-limit.adapter.ts
/**
 * Adapter: Bank Limit Service
 * 
 * Implementa interface do core usando service real do module.
 */

import type { BankLimitPort } from '@core/bank/ports';
import { toMoneyCents } from '@contracts/marketplace/canonical';
import { bankLimitService as realService } from '../bank-limit.service';

export class BankLimitAdapter implements BankLimitPort {
  /**
   * Fronteira do módulo: `attemptedAmount` segue o nome do BankLimitPort, mas o valor
   * é sempre normalizado para centavos inteiros (§4.7) antes do serviço.
   */
  async validateLimit(
    tenantId: string,
    actorId: string,
    limitType: any,
    attemptedAmount: number,
    actingUserId?: string,
    stepUpVerified?: boolean
  ): Promise<void> {
    const attemptedAmountCents = toMoneyCents(attemptedAmount);
    return realService.validateLimit(
      tenantId,
      actorId,
      limitType,
      attemptedAmountCents,
      actingUserId,
      stepUpVerified
    );
  }
}

export const bankLimitAdapter = new BankLimitAdapter();





