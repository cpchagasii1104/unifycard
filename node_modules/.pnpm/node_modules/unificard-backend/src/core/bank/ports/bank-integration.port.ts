// src/core/bank/ports/bank-integration.port.ts
/**
 * Port: Bank Integration Service
 * 
 * Interface para service de integração bancária.
 * Implementação real está em @modules/bank
 */

import type { BankCurrency } from './bank-account.port';

export interface BankIntegrationPort {
  processEventTicketPayment(
    tenantId: string,
    input: {
      eventId: string;
      buyerUserId: string;
      amountCents: number;
      currency?: BankCurrency;
      idempotencyKey?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<{
    transactionId: string;
    splits: Array<{ accountId: string; amountCents: number }>;
  }>;
  
  processEventConsumptionPayment(
    tenantId: string,
    input: {
      eventId: string;
      buyerUserId: string;
      amountCents: number;
      currency?: BankCurrency;
      idempotencyKey?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<{
    transactionId: string;
    splits: Array<{ accountId: string; amountCents: number }>;
  }>;
  
  getUserBalance(
    tenantId: string,
    userId: string,
    currency?: BankCurrency
  ): Promise<number>;
}






