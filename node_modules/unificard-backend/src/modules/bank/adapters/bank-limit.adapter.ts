// src/modules/bank/adapters/bank-limit.adapter.ts
/**
 * Adapter: Bank Limit Service
 * 
 * Implementa interface do core usando service real do module.
 */

import type { BankLimitPort } from '@core/bank/ports';
import { bankLimitService as realService } from '../bank-limit.service';

export class BankLimitAdapter implements BankLimitPort {
  async validateLimit(
    tenantId: string,
    actorId: string,
    limitType: any,
    attemptedAmount: number,
    actingUserId?: string,
    stepUpVerified?: boolean
  ): Promise<void> {
    return realService.validateLimit(tenantId, actorId, limitType, attemptedAmount, actingUserId, stepUpVerified);
  }
}

export const bankLimitAdapter = new BankLimitAdapter();





