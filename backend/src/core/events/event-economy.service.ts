// src/core/events/event-economy.service.ts
// Serviço de economia para eventos conforme CONTRATO DE EVENTOS v1
// FASE 7: ECONOMIA (EVENTOS + SPLIT ENGINE)

import { runQueryWithTenant } from '@core/database/pool';
import { splitEngineService } from '../economy/split.service';
import { accountService } from '../economy/accounts/account.service';
import { transactionService } from '../economy/transactions/transaction.service';
import { referralSplitService } from '../economy/referral-split.service';
import { groupAccountService } from '../economy/group-account.service';
import { BadRequestError, NotFoundError } from '@core/errors';
import type { SplitContext, SplitResult } from '../economy/split.types';
import { v4 as uuidv4 } from 'uuid';

export interface EventSplitTemplate {
  eventId: string;
  ticketPriceCents: number;
  splits: Array<{
    targetType: 'EVENT_ORGANIZER' | 'TENANT' | 'REGION' | 'GROUP';
    percentage: number;
    description: string;
  }>;
  totalPercentage: number; // Deve ser 1.0 (100%)
}

export interface EventCheckoutInput {
  eventId: string;
  attendeeActorId: string; // Actor que está comprando o ingresso
  quantity?: number; // Quantidade de ingressos (padrão: 1)
}

export interface EventCheckoutResult {
  eventId: string;
  attendeeId: string; // ID do registro em event_attendees
  transactionId: string;
  splitResult: SplitResult;
  totalAmountCents: number; // Em centavos
}

class EventEconomyService {
  /**
   * Valida se evento pago tem split válido
   * CONTRATO v1: Evento pago SEM split = NÃO publica
   */
  async validateEventEconomy(
    tenantId: string,
    eventId: string
  ): Promise<{ isValid: boolean; reason?: string }> {
    // Buscar evento
    const event = await runQueryWithTenant<{
      id: string;
      ticket_price_cents: number | null;
      actor_id: string;
      actor_type: string;
      status: string;
    }>(
      tenantId,
      `
      SELECT id, ticket_price_cents, actor_id, actor_type, status
      FROM events
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
      `,
      [tenantId, eventId]
    );

    if (!event) {
      return { isValid: false, reason: 'Evento não encontrado' };
    }

    // Evento gratuito não precisa de split
    if (!event.ticketPriceCents || event.ticketPriceCents === 0) {
      return { isValid: true };
    }

    // Evento pago: validar split
    // Por enquanto, validamos apenas se o split pode ser calculado
    // (split é calculado dinamicamente, não armazenado)
    // TODO: Se houver necessidade de armazenar split template, validar aqui

    // Validar que actor tem conta (necessário para split)
    const organizerAccount = await this.resolveOrganizerAccount(
      tenantId,
      event.actorId,
      event.actorType
    );

    if (!organizerAccount) {
      return {
        isValid: false,
        reason: 'Organizador do evento não possui conta para receber pagamentos',
      };
    }

    // Validar que split pode ser calculado
    try {
      const splitContext: SplitContext = {
        tenantId,
        amountCents: event.ticketPriceCents / 100, // Converter centavos para reais
        currency: 'BRL',
        source: 'event_ticket',
        customerAccountId: '', // Não necessário para validação
        eventOrganizerAccountId: organizerAccount,
        metadata: {
          module: 'EVENT_TICKET',
          eventId: event.id,
        },
      };

      const splitResult = splitEngineService.calculateSplits(splitContext);

      // Validar que soma dos percentuais = 100%
      const totalPercentage = splitResult.splits.reduce(
        (sum, split) => sum + split.rule.percentage,
        0
      );

      if (Math.abs(totalPercentage - 1.0) > 0.01) {
        return {
          isValid: false,
          reason: `Split inválido: soma dos percentuais (${(totalPercentage * 100).toFixed(2)}%) não é 100%`,
        };
      }

      return { isValid: true };
    } catch (error: any) {
      // Log estruturado: erro ao validar split
      // Nota: logger será injetado via fastify.log nas rotas
      console.warn('[EventEconomy] Erro ao validar economia do evento:', {
        tenant_id: tenantId,
        event_id: eventId,
        error: error.message,
        'economy.action': 'event.economy.validate.error',
      });

      return {
        isValid: false,
        reason: `Erro ao validar split: ${error.message}`,
      };
    }
  }

  /**
   * Resolve conta do organizador do evento
   * CONTRATO v1: Actor pode ser 'user' ou 'page'
   * - user actor → user_id → account com owner_type='user'
   * - page actor → company_id → account com owner_type='merchant'
   */
  private async resolveOrganizerAccount(
    tenantId: string,
    actorId: string,
    actorType: string
  ): Promise<string | null> {
    // Buscar actor para obter user_id ou company_id
    const actor = await runQueryWithTenant<{
      user_id: string | null;
      company_id: string | null;
    }>(
      tenantId,
      `
      SELECT user_id, company_id
      FROM actors
      WHERE tenant_id = $1 AND actor_id = $2
      LIMIT 1
      `,
      [tenantId, actorId]
    );

    if (!actor) {
      return null;
    }

    // Resolver owner_id e owner_type baseado no actor_type
    let ownerId: string | null = null;
    let ownerType: 'user' | 'merchant' | null = null;

    if (actorType === 'user' && actor.user_id) {
      ownerId = actor.user_id;
      ownerType = 'user';
    } else if (actorType === 'page' && actor.company_id) {
      ownerId = actor.company_id;
      ownerType = 'merchant';
    } else {
      return null;
    }

    // Buscar ou criar conta
    const accounts = await accountService.getAccountsByOwner(
      tenantId,
      ownerId,
      ownerType
    );

    if (accounts.length > 0) {
      return accounts[0].accountId;
    }

    // Criar conta se não existir
    try {
      const account = await accountService.createAccount(tenantId, {
        ownerId,
        ownerType,
        currency: 'BRL',
      });
      return account.accountId;
    } catch (error) {
      // Se já existe, buscar novamente
      const accountsRetry = await accountService.getAccountsByOwner(
        tenantId,
        ownerId,
        ownerType
      );
      return accountsRetry.length > 0 ? accountsRetry[0].accountId : null;
    }
  }

  /**
   * Cria split template para evento (apenas cálculo, não cria transações)
   * CONTRATO v1: Split é calculado dinamicamente, não armazenado
   */
  async createSplitTemplate(
    tenantId: string,
    eventId: string
  ): Promise<EventSplitTemplate> {
    // Buscar evento
    const event = await runQueryWithTenant<{
      id: string;
      ticket_price_cents: number | null;
      actor_id: string;
      actor_type: string;
    }>(
      tenantId,
      `
      SELECT id, ticket_price_cents, actor_id, actor_type
      FROM events
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
      `,
      [tenantId, eventId]
    );

    if (!event) {
      throw new NotFoundError('Evento não encontrado');
    }

    if (!event.ticketPriceCents || event.ticketPriceCents === 0) {
      throw new BadRequestError('Evento gratuito não possui split');
    }

    // Resolver conta do organizador
    const organizerAccount = await this.resolveOrganizerAccount(
      tenantId,
      event.actorId,
      event.actorType
    );

    if (!organizerAccount) {
      throw new BadRequestError('Organizador do evento não possui conta');
    }

    // Calcular split
    const splitContext: SplitContext = {
      tenantId,
      amountCents: event.ticketPriceCents / 100, // Converter centavos para reais
      currency: 'BRL',
      source: 'event_ticket',
      customerAccountId: '', // Não necessário para cálculo
      eventOrganizerAccountId: organizerAccount,
      metadata: {
        module: 'EVENT_TICKET',
        eventId: event.id,
      },
    };

    const splitResult = splitEngineService.calculateSplits(splitContext);

    // Converter para template
    const totalPercentage = splitResult.splits.reduce(
      (sum, split) => sum + split.rule.percentage,
      0
    );

    return {
      eventId: event.id,
      ticketPriceCents: event.ticketPriceCents,
      splits: splitResult.splits.map((split) => ({
        targetType: split.rule.targetType as 'EVENT_ORGANIZER' | 'TENANT' | 'REGION' | 'GROUP',
        percentage: split.rule.percentage,
        description: split.rule.description || '',
      })),
      totalPercentage,
    };
  }

  /**
   * Processa checkout de ingresso de evento
   * CONTRATO v1: Executa split, grava ledger, cria attendee
   */
  async processCheckout(
    tenantId: string,
    input: EventCheckoutInput
  ): Promise<EventCheckoutResult> {
    const { eventId, attendeeActorId, quantity = 1 } = input;

    // 1. Buscar evento
    const event = await runQueryWithTenant<{
      id: string;
      ticket_price_cents: number | null;
      max_attendees: number | null;
      status: string;
      actor_id: string;
      actor_type: string;
    }>(
      tenantId,
      `
      SELECT id, ticket_price_cents, max_attendees, status, actor_id, actor_type
      FROM events
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
      `,
      [tenantId, eventId]
    );

    if (!event) {
      throw new NotFoundError('Evento não encontrado');
    }

    // 2. Validar que evento está publicado e não está cancelado/finalizado
    if (event.status !== 'published') {
      if (event.status === 'cancelled' || event.status === 'completed' || event.status === 'archived') {
        throw new BadRequestError(`Evento com status '${event.status}' não aceita compras`);
      }
      console.warn('[EventEconomy] Tentativa de checkout em evento não publicado:', {
        tenant_id: tenantId,
        event_id: eventId,
        status: event.status,
        'economy.action': 'event.checkout.error.status',
      });
      throw new BadRequestError(`Evento com status '${event.status}' não aceita compras. Apenas eventos publicados.`);
    }

    // 3. Validar que evento é pago
    if (!event.ticket_price_cents || event.ticket_price_cents === 0) {
      // Nota: logger será injetado via fastify.log nas rotas
      console.warn('[EventEconomy] Tentativa de checkout em evento gratuito:', {
        tenant_id: tenantId,
        event_id: eventId,
        'economy.action': 'event.checkout.error.free',
      });
      throw new BadRequestError('Evento gratuito não requer checkout');
    }

    // 4. Validar capacidade
    if (event.max_attendees) {
      const currentAttendees = await runQueryWithTenant<{ count: string }>(
        tenantId,
        `
        SELECT COUNT(*) as count
        FROM event_attendees
        WHERE tenant_id = $1 AND event_id = $2 
          AND (check_in_status = 'confirmed' OR check_in_status = 'pending')
        `,
        [tenantId, eventId]
      );

      const currentCount = parseInt(currentAttendees?.count || '0', 10);
      if (currentCount + quantity > event.max_attendees) {
        // Nota: logger será injetado via fastify.log nas rotas
        console.warn('[EventEconomy] Tentativa de checkout excedendo capacidade:', {
          tenant_id: tenantId,
          event_id: eventId,
          current_count: currentCount,
          max_attendees: event.max_attendees,
          requested_quantity: quantity,
          'economy.action': 'event.checkout.error.capacity',
        });
        throw new BadRequestError(
          `Capacidade máxima atingida. Restam ${event.max_attendees - currentCount} vagas.`
        );
      }
    }

    // 5. Resolver contas
    // Buscar actor do attendee para determinar tipo
    const attendeeActor = await runQueryWithTenant<{
      actor_type: string;
      user_id: string | null;
    }>(
      tenantId,
      `
      SELECT actor_type, user_id
      FROM actors
      WHERE tenant_id = $1 AND actor_id = $2
      LIMIT 1
      `,
      [tenantId, attendeeActorId]
    );

    if (!attendeeActor) {
      throw new NotFoundError('Actor do comprador não encontrado');
    }

    // Resolver conta do comprador
    let customerAccount: string | null = null;
    if (attendeeActor.actor_type === 'user' && attendeeActor.user_id) {
      const customerAccounts = await accountService.getAccountsByOwner(
        tenantId,
        attendeeActor.user_id,
        'user'
      );
      if (customerAccounts.length > 0) {
        customerAccount = customerAccounts[0].accountId;
      } else {
        // Criar conta se não existir
        const account = await accountService.getOrCreateUserPrimaryAccount(
          tenantId,
          attendeeActor.user_id,
          'BRL'
        );
        customerAccount = account.accountId;
      }
    }

    if (!customerAccount) {
      throw new BadRequestError('Comprador não possui conta para realizar pagamento');
    }

    const organizerAccount = await this.resolveOrganizerAccount(
      tenantId,
      event.actor_id,
      event.actor_type
    );

    if (!organizerAccount) {
      throw new BadRequestError('Organizador do evento não possui conta');
    }

    // 6. Calcular total
    const totalAmountCents = event.ticket_price_cents * quantity;

    // 7. CONTRATO v1.3: Dinheiro vai para ESCROW, não split imediato
    // Transferir dinheiro do comprador para uma conta de escrow (ou usar transaction service)
    // Por enquanto, vamos criar a transação e depositar no escrow
    const { escrowService } = await import('../economy/escrow.service');
    const { transactionService } = await import('../economy/transactions/transaction.service');

    // Verificar se escrow existe (deve ter sido criado na publicação)
    const escrow = await escrowService.getEscrowByEvent(tenantId, eventId);
    if (!escrow) {
      throw new BadRequestError('Escrow não encontrado. Evento deve ser publicado primeiro.');
    }

    // Criar transação: comprador → escrow (conta especial ou sistema)
    // Por enquanto, vamos usar uma conta de escrow do sistema
    // TODO: Criar conta de escrow por evento ou usar conta geral de escrow
    const escrowAccountId = await this.getOrCreateEscrowAccount(tenantId, eventId);

    // Transferir dinheiro do comprador para escrow
    const transactionId = uuidv4();
    await transactionService.transfer(tenantId, {
      fromAccount: customerAccount,
      toAccount: escrowAccountId,
      amountCents: totalAmountCents / 100, // Converter para reais
      eventId: transactionId,
      metadata: {
        module: 'EVENT_TICKET',
        eventId: event.id,
        quantity,
        type: 'escrow_deposit',
      },
    });

    // Depositar no escrow
    const idempotencyKey = `checkout-${eventId}-${attendeeActorId}-${Date.now()}`;
    await escrowService.deposit(tenantId, {
      eventId: event.id,
      sourceAccountId: customerAccount,
      amountCents: totalAmountCents,
      ticketId: undefined, // Será preenchido após criar attendee
      idempotencyKey,
    });

    // 8. Criar registro de attendee
    // CONTRATO v1.3: check_in_status começa como 'pending' (check-in será feito depois)
    const attendee = await runQueryWithTenant<{ id: string }>(
      tenantId,
      `
      INSERT INTO event_attendees (
        tenant_id, event_id, actor_id, check_in_status, transaction_id, metadata
      )
      VALUES ($1, $2, $3, 'PENDING', $4, $5)
      ON CONFLICT (tenant_id, event_id, actor_id) DO UPDATE
      SET metadata = $5, transaction_id = $4, updatedAt = NOW()
      RETURNING id
      `,
      [
        tenantId,
        eventId,
        attendeeActorId,
        transactionId,
        JSON.stringify({
          checkout_transaction_id: transactionId,
          quantity,
          total_amount_cents: totalAmountCents,
          checkoutAt: new Date().toISOString(),
          escrow_deposit: true, // CONTRATO v1.3: dinheiro está em escrow
          escrow_id: escrow.id,
        }),
      ]
    );

    if (!attendee) {
      throw new Error('Falha ao criar registro de attendee');
    }

    // 9. Processar split de referral (se aplicável)
    // Buscar userId do attendeeActorId para verificar se foi indicado
    try {
      const actorResult = await runQueryWithTenant<{ user_id: string | null }>(
        tenantId,
        `
        SELECT user_id
        FROM actors
        WHERE actor_id = $1 AND tenant_id = $2
        LIMIT 1
        `,
        [attendeeActorId, tenantId]
      );

      const sourceUserId = actorResult?.user_id;
      if (sourceUserId) {
        await referralSplitService.processReferralSplit({
          tenantId,
          transactionId: transactionId,
          sourceUserId: sourceUserId,
          amountCents: totalAmountCents,
          percentageBps: 500, // 5% de comissão para indicador
          metadata: {
            type: 'ticket_purchase',
            eventId: event.id,
            attendeeId: attendee.id,
          },
        });
      }
    } catch (err) {
      // Não falha o checkout se split falhar
      const { devLog } = await import('@utils/devLog');
      devLog.warn('referral.split.event_payment_error', { 
        error: err instanceof Error ? err.message : String(err) 
      });
    }

    // 10. Retornar resultado
    // CONTRATO v1.3: Não retornamos splitResult (split só acontece pós-evento)
    return {
      eventId: event.id,
      attendeeId: attendee.id,
      transactionId: transactionId,
      splitResult: {
        totalAmount: totalAmountCents / 100,
        splits: [], // Split será feito pós-evento
      },
      totalAmountCents: totalAmountCents,
    };
  }

  /**
   * Obtém ou cria conta de escrow para evento
   * CONTRATO v1.3: Conta especial para guardar dinheiro do evento
   * Por enquanto, usar conta do sistema (platform_ops)
   */
  private async getOrCreateEscrowAccount(tenantId: string, eventId: string): Promise<string> {
    // Por enquanto, usar uma conta de escrow geral do sistema
    // TODO: Criar conta específica por evento se necessário
    const escrowAccount = await runQueryWithTenant<{ account_id: string }>(
      tenantId,
      `
      SELECT account_id
      FROM accounts
      WHERE tenant_id = $1
        AND owner_type = 'platform_ops'
        AND owner_id = $1
      LIMIT 1
      `,
      [tenantId]
    );

    if (escrowAccount) {
      return escrowAccount.account_id;
    }

    // Criar conta de escrow se não existir
    // Por enquanto, usar uma conta temporária do sistema
    // Em produção, isso deve ser uma conta especial de escrow
    const accounts = await accountService.getAccountsByOwner(tenantId, tenantId, 'platform_ops');
    if (accounts.length > 0) {
      return accounts[0].accountId;
    }

    // Se não existir, criar conta de escrow do sistema
    // NOTA: Em produção, isso deve ser feito via migration ou seed
    throw new BadRequestError('Conta de escrow não configurada. Contate o administrador.');
  }
}

export const eventEconomyService = new EventEconomyService();



