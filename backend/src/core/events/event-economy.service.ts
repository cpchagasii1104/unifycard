// backend/src/core/events/event-economy.service.ts
// FASE 2 — Event Economy: processCheckout, bank_transaction, bank_splits, bank_ledger. amountCents canônico.

import { v4 as uuidv4 } from 'uuid';
import { BadRequestError, NotFoundError } from '@core/errors';
import { bankPortsRegistry } from '@core/bank/ports-registry';
import { bankTransactionService } from '@modules/bank';
import type { FinancialAuthorshipContext } from '@modules/bank/financial-authorship.types';
import { eventService } from './event.service';
import type {
  ProcessCheckoutInput,
  CheckoutResult,
  CheckoutSplitItem,
} from './event-economy.types';

class EventEconomyService {
  /**
   * Processa checkout: cria bank_transaction, bank_splits, bank_ledger. Retorno tipado.
   */
  async processCheckout(
    tenantId: string,
    input: ProcessCheckoutInput
  ): Promise<CheckoutResult> {
    const { eventId, attendeeActorId, quantity } = input;

    if (quantity < 1 || quantity > 10) {
      throw new BadRequestError('quantity deve estar entre 1 e 10.');
    }

    const event = await eventService.getEvent(tenantId, eventId);
    if (!event) {
      throw new NotFoundError('Evento não encontrado');
    }

    const ticketPriceCents = event.ticketPriceCents ?? 0;
    const totalAmountCents = ticketPriceCents * quantity;
    if (totalAmountCents <= 0) {
      throw new BadRequestError('Evento sem preço de ingresso configurado');
    }

    const bankAccount = bankPortsRegistry.getBankAccount();
    const attendeeAccount = await bankAccount.getOrCreateAccount(tenantId, {
      ownerId: attendeeActorId,
      ownerType: 'user',
      currency: 'BRL',
    });

    const checkoutEventId = uuidv4();
    const now = new Date().toISOString();
    const authorship: FinancialAuthorshipContext = {
      performedByUserId: null,
      actingForActorId: attendeeActorId,
      actingForAccountId: attendeeAccount.accountId,
      authoritySource: 'system',
      permissionSnapshot: {
        permissionKey: 'event.checkout',
        allowed: true,
        actorId: attendeeActorId,
        userId: '',
        decidedAt: now,
      },
    };

    const result = await bankTransactionService.createTransactionWithSplit(
      tenantId,
      {
        eventId: checkoutEventId,
        fromAccountId: attendeeAccount.accountId,
        amountCents: totalAmountCents,
        currency: 'BRL',
        context: 'event_ticket',
        description: `Checkout evento ${eventId}, ${quantity} ingresso(s)`,
        metadata: { eventId, attendeeActorId, quantity },
        authorship,
      }
    );

    const splits: CheckoutSplitItem[] = result.splits.map((s) => ({
      rule: {
        targetType: s.splitType,
        percentage: s.percentage ?? 0,
      },
      amountCents: s.amountCents,
      transactionId: s.transactionId,
    }));

    const checkoutResult: CheckoutResult = {
      eventId,
      attendeeId: attendeeActorId,
      transactionId: result.transaction.transactionId,
      totalAmountCents,
      splitResult: { splits },
    };

    return checkoutResult;
  }
}

export const eventEconomyService = new EventEconomyService();