// src/modules/bank/adapters/bank-integration.adapter.ts
/**
 * Adapter: Bank Integration Service
 * 
 * Implementa interface do core usando service real do module.
 */

import type { BankIntegrationPort } from '@core/bank/ports';
import { bankIntegrationService as realService } from '../bank-integration.service';

export class BankIntegrationAdapter implements BankIntegrationPort {
  async processEventTicketPayment(tenantId: string, input: any) {
    return realService.processEventTicketPayment(tenantId, input);
  }

  async processEventConsumptionPayment(tenantId: string, input: any) {
    return realService.processEventConsumptionPayment(tenantId, input);
  }

  async getUserBalance(tenantId: string, userId: string, currency?: any) {
    return realService.getUserBalance(tenantId, userId, currency);
  }
}

export const bankIntegrationAdapter = new BankIntegrationAdapter();





