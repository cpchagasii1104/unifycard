// src/core/bank/ports/bank-limit.port.ts
/**
 * Port: Bank Limit Service
 * 
 * Interface para service de limites bancários.
 * Implementação real está em @modules/bank
 */

export type BankLimitType = 'payment_out' | 'payment_in' | 'transfer' | 'withdrawal';

export interface BankLimitPort {
  validateLimit(
    tenantId: string,
    actorId: string,
    limitType: BankLimitType,
    attemptedAmount: number,
    actingUserId?: string,
    stepUpVerified?: boolean
  ): Promise<void>;
}





