// src/modules/bank/adapters/bank-integration.adapter.ts
/**
 * Adapter: Bank Integration Service
 *
 * Implementa interface do core usando service real do module.
 * Fronteira: tipos do port + montantes normalizados antes do serviço (§4.7).
 */

import type { BankIntegrationPort } from '@core/bank/ports';
import { parsePositiveMoneyToCents } from '../bank-http-money';
import { asMoneyCents } from '@contracts/marketplace/canonical';
import { bankIntegrationService as realService } from '../bank-integration.service';

type TicketIn = Parameters<BankIntegrationPort['processEventTicketPayment']>[1];
type ConsumptionIn = Parameters<BankIntegrationPort['processEventConsumptionPayment']>[1];

export class BankIntegrationAdapter implements BankIntegrationPort {
  async processEventTicketPayment(tenantId: string, input: TicketIn) {
    const amountCents = parsePositiveMoneyToCents(input.amountCents, 'amountCents');
    return realService.processEventTicketPayment(tenantId, { ...input, amountCents });
  }

  async processEventConsumptionPayment(tenantId: string, input: ConsumptionIn) {
    const amountCents = parsePositiveMoneyToCents(input.amountCents, 'amountCents');
    return realService.processEventConsumptionPayment(tenantId, { ...input, amountCents });
  }

  /** Retorno: centavos inteiros (nome do port é genérico `number`; valor sempre em centavos). */
  async getUserBalance(tenantId: string, userId: string, currency?: Parameters<BankIntegrationPort['getUserBalance']>[2]) {
    const cents = await realService.getUserBalance(tenantId, userId, currency);
    return asMoneyCents(cents);
  }

  /**
   * 2026-05-18 P1 — Bank actor-context. Resolve saldo por actor (qualquer tipo).
   * Authority validada pelo caller (rota usa actorCapabilitiesService).
   */
  async getActorBalance(tenantId: string, actorId: string, currency?: Parameters<BankIntegrationPort['getActorBalance']>[2]) {
    const cents = await realService.getActorBalance(tenantId, actorId, currency);
    return asMoneyCents(cents);
  }
}

export const bankIntegrationAdapter = new BankIntegrationAdapter();





