// backend/src/core/events/event-economy.service.ts
// Camada econômica de eventos — tradução semântica HTTP→domain.
//
// Esta service NÃO duplica lógica financeira: DELEGA para
// `bank-integration.processEventTicketPayment` (runtime soberano consolidado),
// preservando memória operacional do legado:
//   - validação de limite diário (bankLimitService)
//   - autoria financeira via ownership (não system bypass)
//   - idempotência (idempotencyKey || uuidv4 fallback)
//   - ensureUserActor (cria actor se não existir)
//   - suporte a organizer 'user' E 'page'/'company' (via resolveEventOrganizerAccount)
//   - helpers reutilizados em 9+ caminhos cross-context
//
// Padrão arquitetural: análogo a `events-payment.service.processEventPayment`
// (wrapper de delegação). Convergência via absorção do legado, não duplicação.
// Vide executei_23.md para análise material completa.

import { BadRequestError, NotFoundError } from '@core/errors';
import { bankPortsRegistry } from '@core/bank/ports-registry';
import { runQueryWithTenant } from '@core/database/pool';
import { eventService } from './event.service';
import type {
  ProcessCheckoutInput,
  CheckoutResult,
  CheckoutSplitItem,
} from './event-economy.types';

class EventEconomyService {
  /**
   * Processa checkout de ingresso de evento.
   *
   * Responsabilidade desta camada:
   *   1. Validações específicas do domínio HTTP (quantity, ticket_price)
   *   2. Tradução semântica HTTP→domain (attendee_actor_id → buyer_user_id)
   *   3. Delegação para bank-integration.processEventTicketPayment (runtime soberano)
   *   4. Mapeamento de retorno para tipo CheckoutResult
   *
   * NÃO implementa: validação financeira, autoria, idempotência, resolução de
   * contas, criação de actor. Esses são responsabilidade de bank-integration.
   */
  async processCheckout(
    tenantId: string,
    input: ProcessCheckoutInput
  ): Promise<CheckoutResult> {
    const { eventId, attendeeActorId, quantity } = input;

    // 1. Validações específicas do domínio HTTP
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

    // 2. Tradução semântica: rota HTTP envia attendee_actor_id (actor_id);
    // bank-integration.processEventTicketPayment espera buyer_user_id (user_id).
    const actorRow = await runQueryWithTenant<{ user_id: string | null }>(
      tenantId,
      `SELECT user_id FROM actors WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
      [tenantId, attendeeActorId]
    );
    const attendeeUserId = actorRow?.user_id;
    if (!attendeeUserId) {
      throw new BadRequestError('Attendee actor não está vinculado a um user');
    }

    // 3. Delegação para runtime soberano (bank-integration).
    // Preserva limite diário, autoria ownership, idempotência, ensureUserActor,
    // resolveEventOrganizerAccount (suporta user E page/company).
    const bankIntegration = bankPortsRegistry.getBankIntegration();
    const result = await bankIntegration.processEventTicketPayment(tenantId, {
      eventId,
      buyerUserId: attendeeUserId,
      amountCents: totalAmountCents,
      currency: 'BRL',
      metadata: { quantity, attendeeActorId },
    });

    // 4. Mapeamento de retorno para tipo CheckoutResult específico de event-economy.
    // bank-integration retorna { transactionId, splits: [{accountId, amountCents}] }.
    // CheckoutResult espera splits: [{rule: {targetType, percentage}, amountCents, transactionId}].
    const splits: CheckoutSplitItem[] = result.splits.map((s) => ({
      rule: {
        targetType: 'revenue_share', // bank-integration não expõe splitType no retorno; preservar semântica de "share"
        percentage: 0, // bank-integration não expõe percentage no retorno; downstream pode recalcular via amountCents/totalAmountCents
      },
      amountCents: s.amountCents,
      transactionId: result.transactionId,
    }));

    return {
      eventId,
      attendeeId: attendeeActorId,
      transactionId: result.transactionId,
      totalAmountCents,
      splitResult: { splits },
    };
  }
}

export const eventEconomyService = new EventEconomyService();