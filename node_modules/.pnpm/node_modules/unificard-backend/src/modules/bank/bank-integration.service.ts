// backend/src/modules/bank/bank-integration.service.ts
// SPRINT 3: SYSTEM INTEGRATION WITH UNIFY BANK
// Serviço de integração entre módulos e Unify Bank

import { v4 as uuidv4 } from 'uuid';
import { bankAccountService } from './bank-account.service';
import { bankTransactionService } from './bank-transaction.service';
import { buildFinancialAuthorshipFromRequest } from './financial-authorship.helper';
import type { BankTransactionContext } from './bank-split.types';
import type { BankCurrency } from './bank-account.types';

/**
 * Resolve ou cria conta de usuário no Unify Bank
 */
async function resolveUserAccount(
  tenantId: string,
  userId: string,
  currency: BankCurrency = 'BRL'
): Promise<string> {
  const account = await bankAccountService.getOrCreateAccount(tenantId, {
    ownerId: userId,
    ownerType: 'user',
    currency,
  });
  return account.accountId;
}

/**
 * Resolve ou cria conta de empresa/organizador no Unify Bank
 */
async function resolveCompanyAccount(
  tenantId: string,
  companyId: string,
  currency: BankCurrency = 'BRL'
): Promise<string> {
  const account = await bankAccountService.getOrCreateAccount(tenantId, {
    ownerId: companyId,
    ownerType: 'company',
    currency,
  });
  return account.accountId;
}

/**
 * Resolve ou cria conta de grupo no Unify Bank
 */
async function resolveGroupAccount(
  tenantId: string,
  groupId: string,
  currency: BankCurrency = 'BRL'
): Promise<string> {
  // Grupos usam ownerType 'company' por enquanto (pode ser ajustado depois)
  const account = await bankAccountService.getOrCreateAccount(tenantId, {
    ownerId: groupId,
    ownerType: 'company', // TODO: Adicionar 'group' como ownerType se necessário
    currency,
  });
  return account.accountId;
}

/**
 * Resolve conta do organizador de evento
 */
async function resolveEventOrganizerAccount(
  tenantId: string,
  eventId: string,
  currency: BankCurrency = 'BRL'
): Promise<string | null> {
  // Mock: buscar evento e resolver conta do organizador
  // Em produção, isso buscaria o evento e o actor_id/actor_type
  const { getClientWithTenant } = await import('@core/database/pool');
  const client = await getClientWithTenant(tenantId);

  try {
    const result = await client.query<{
      actor_id: string;
      actor_type: string;
    }>(
      `
      SELECT actor_id, actor_type
      FROM events
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
      `,
      [tenantId, eventId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const event = result.rows[0];

    if (event.actor_type === 'user') {
      return await resolveUserAccount(tenantId, event.actor_id, currency);
    } else if (event.actor_type === 'page' || event.actor_type === 'company') {
      return await resolveCompanyAccount(tenantId, event.actor_id, currency);
    }

    return null;
  } finally {
    client.release();
  }
}

class BankIntegrationService {
  /**
   * Processa pagamento de ingresso de evento
   * Cria transação no Unify Bank com split automático
   */
  async processEventTicketPayment(
    tenantId: string,
    input: {
      eventId: string;
      buyerUserId: string;
      amount: number;
      currency?: BankCurrency;
      idempotencyKey?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<{ transactionId: string; splits: Array<{ accountId: string; amount: number }> }> {
    const { eventId, buyerUserId, amount, currency = 'BRL', idempotencyKey, metadata } = input;

    // SPRINT 36.2: Validar limite diário (enforcement)
    try {
      const { bankLimitService } = await import('./bank-limit.service');
      await bankLimitService.validateLimit(
        tenantId,
        buyerUserId,
        'payment_out',
        amount,
        buyerUserId
      );
    } catch (limitError: any) {
      // Re-throw erro de limite (já tem statusCode 403)
      if (limitError.statusCode === 403) {
        throw limitError;
      }
      // Se não for erro de limite, logar mas não bloquear (fail-open)
      console.warn('[BankLimit] Erro ao validar limite (não bloqueante):', limitError);
    }

    // Resolver conta do comprador
    const buyerAccountId = await resolveUserAccount(tenantId, buyerUserId, currency);

    // Resolver conta do organizador
    const organizerAccountId = await resolveEventOrganizerAccount(tenantId, eventId, currency);
    if (!organizerAccountId) {
      throw new Error(`Organizer account not found for event ${eventId}`);
    }

    // Resolver actor do comprador para autoria
    const { actorRepository } = await import('@modules/social/actor.repository');
    const buyerActor = await actorRepository.findOrCreateUserActor(tenantId, buyerUserId);

    // Construir autoria (ownership: comprador é dono da conta)
    const authorship = buildFinancialAuthorshipFromRequest({
      performedByUserId: buyerUserId,
      actingForActorId: buyerActor.actor_id,
      actingForAccountId: buyerAccountId,
      authoritySource: 'ownership', // Comprador é dono da conta origem
    });

    // Criar transação com split (event_ticket context)
    const eventIdForTransaction = idempotencyKey || uuidv4();
    const result = await bankTransactionService.createTransactionWithSplit(tenantId, {
      eventId: eventIdForTransaction,
      fromAccountId: buyerAccountId,
      amount,
      currency,
      context: 'event_ticket',
      revenueShareAccountId: organizerAccountId,
      fromUserId: buyerUserId, // Para calcular referral e group allocation
      description: `Event ticket purchase: ${eventId}`,
      metadata: {
        ...metadata,
        eventId,
        buyerUserId,
        type: 'event_ticket',
      },
      authorship,
    });

    return {
      transactionId: result.transaction.transactionId,
      splits: result.splits.map((split) => ({
        accountId: split.targetAccountId,
        amount: split.amount,
      })),
    };
  }

  /**
   * Processa pagamento de consumo em evento
   * Cria transação no Unify Bank com split automático
   */
  async processEventConsumptionPayment(
    tenantId: string,
    input: {
      eventId: string;
      buyerUserId: string;
      amount: number;
      currency?: BankCurrency;
      idempotencyKey?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<{ transactionId: string; splits: Array<{ accountId: string; amount: number }> }> {
    const { eventId, buyerUserId, amount, currency = 'BRL', idempotencyKey, metadata } = input;

    // SPRINT 36.2: Validar limite diário (enforcement)
    try {
      const { bankLimitService } = await import('./bank-limit.service');
      await bankLimitService.validateLimit(
        tenantId,
        buyerUserId,
        'payment_out',
        amount,
        buyerUserId
      );
    } catch (limitError: any) {
      // Re-throw erro de limite (já tem statusCode 403)
      if (limitError.statusCode === 403) {
        throw limitError;
      }
      // Se não for erro de limite, logar mas não bloquear (fail-open)
      console.warn('[BankLimit] Erro ao validar limite (não bloqueante):', limitError);
    }

    // Resolver conta do comprador
    const buyerAccountId = await resolveUserAccount(tenantId, buyerUserId, currency);

    // Resolver conta do organizador
    const organizerAccountId = await resolveEventOrganizerAccount(tenantId, eventId, currency);
    if (!organizerAccountId) {
      throw new Error(`Organizer account not found for event ${eventId}`);
    }

    // Resolver actor do comprador para autoria
    const { actorRepository } = await import('@modules/social/actor.repository');
    const buyerActor = await actorRepository.findOrCreateUserActor(tenantId, buyerUserId);

    // Construir autoria (ownership: comprador é dono da conta)
    const authorship = buildFinancialAuthorshipFromRequest({
      performedByUserId: buyerUserId,
      actingForActorId: buyerActor.actor_id,
      actingForAccountId: buyerAccountId,
      authoritySource: 'ownership', // Comprador é dono da conta origem
    });

    // Criar transação com split (event_ticket context - mesmo split de ingresso)
    const eventIdForTransaction = idempotencyKey || uuidv4();
    const result = await bankTransactionService.createTransactionWithSplit(tenantId, {
      eventId: eventIdForTransaction,
      fromAccountId: buyerAccountId,
      amount,
      currency,
      context: 'event_ticket',
      revenueShareAccountId: organizerAccountId,
      description: `Event consumption: ${eventId}`,
      metadata: {
        ...metadata,
        eventId,
        buyerUserId,
        type: 'event_consumption',
      },
      authorship,
    });

    return {
      transactionId: result.transaction.transactionId,
      splits: result.splits.map((split) => ({
        accountId: split.targetAccountId,
        amount: split.amount,
      })),
    };
  }

  /**
   * Processa pagamento de booking de serviço
   * Cria transação no Unify Bank com split automático (3% fee)
   */
  async processServiceBookingPayment(
    tenantId: string,
    input: {
      bookingId: string;
      serviceId: string;
      buyerUserId: string;
      providerUserId: string;
      amount: number;
      currency?: BankCurrency;
      idempotencyKey?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<{ transactionId: string; splits: Array<{ accountId: string; amount: number }> }> {
    const { bookingId, serviceId, buyerUserId, providerUserId, amount, currency = 'BRL', idempotencyKey, metadata } = input;

    // SPRINT 36.2: Validar limite diário (enforcement)
    try {
      const { bankLimitService } = await import('./bank-limit.service');
      await bankLimitService.validateLimit(
        tenantId,
        buyerUserId,
        'payment_out',
        amount,
        buyerUserId
      );
    } catch (limitError: any) {
      // Re-throw erro de limite (já tem statusCode 403)
      if (limitError.statusCode === 403) {
        throw limitError;
      }
      // Se não for erro de limite, logar mas não bloquear (fail-open)
      console.warn('[BankLimit] Erro ao validar limite (não bloqueante):', limitError);
    }

    // Resolver contas
    const buyerAccountId = await resolveUserAccount(tenantId, buyerUserId, currency);
    const providerAccountId = await resolveUserAccount(tenantId, providerUserId, currency);

    // Resolver actor do comprador para autoria
    const { actorRepository } = await import('@modules/social/actor.repository');
    const buyerActor = await actorRepository.findOrCreateUserActor(tenantId, buyerUserId);

    // Construir autoria (ownership: comprador é dono da conta)
    const authorship = buildFinancialAuthorshipFromRequest({
      performedByUserId: buyerUserId,
      actingForActorId: buyerActor.actor_id,
      actingForAccountId: buyerAccountId,
      authoritySource: 'ownership', // Comprador é dono da conta origem
    });

    // Criar transação com split (service_booking context)
    const eventIdForTransaction = idempotencyKey || uuidv4();
    const result = await bankTransactionService.createTransactionWithSplit(tenantId, {
      eventId: eventIdForTransaction,
      fromAccountId: buyerAccountId,
      amount,
      currency,
      context: 'service_booking',
      revenueShareAccountId: providerAccountId,
      fromUserId: buyerUserId, // Para calcular referral e group allocation
      description: `Service booking: ${bookingId}`,
      metadata: {
        ...metadata,
        bookingId,
        serviceId,
        buyerUserId,
        providerUserId,
        type: 'service_booking',
      },
      authorship,
    });

    return {
      transactionId: result.transaction.transactionId,
      splits: result.splits.map((split) => ({
        accountId: split.targetAccountId,
        amount: split.amount,
      })),
    };
  }

  /**
   * Processa contribuição para grupo
   * Cria transação no Unify Bank (0% fee, 100% para grupo)
   */
  async processGroupContribution(
    tenantId: string,
    input: {
      groupId: string;
      contributorUserId: string;
      amount: number;
      currency?: BankCurrency;
      idempotencyKey?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<{ transactionId: string }> {
    const { groupId, contributorUserId, amount, currency = 'BRL', idempotencyKey, metadata } = input;

    // Resolver contas
    const contributorAccountId = await resolveUserAccount(tenantId, contributorUserId, currency);
    const groupAccountId = await resolveGroupAccount(tenantId, groupId, currency);

    // Resolver actor do contribuidor para autoria
    const { actorRepository } = await import('@modules/social/actor.repository');
    const contributorActor = await actorRepository.findOrCreateUserActor(tenantId, contributorUserId);

    // Construir autoria (ownership: contribuidor é dono da conta)
    const authorship = buildFinancialAuthorshipFromRequest({
      performedByUserId: contributorUserId,
      actingForActorId: contributorActor.actor_id,
      actingForAccountId: contributorAccountId,
      authoritySource: 'ownership', // Contribuidor é dono da conta origem
    });

    // Criar transação com split (group_contribution context)
    const eventIdForTransaction = idempotencyKey || uuidv4();
    const result = await bankTransactionService.createTransactionWithSplit(tenantId, {
      eventId: eventIdForTransaction,
      fromAccountId: contributorAccountId,
      amount,
      currency,
      context: 'group_contribution',
      revenueShareAccountId: groupAccountId,
      fromUserId: contributorUserId, // Para calcular referral e group allocation
      description: `Group contribution: ${groupId}`,
      metadata: {
        ...metadata,
        groupId,
        contributorUserId,
        type: 'group_contribution',
      },
      authorship,
    });

    return {
      transactionId: result.transaction.transactionId,
    };
  }

  /**
   * Reverte transação (para cancelamentos)
   */
  async reverseTransaction(
    tenantId: string,
    transactionId: string,
    eventId?: string
  ): Promise<{ reversalTransactionId: string }> {
    const result = await bankTransactionService.reverseTransaction(tenantId, transactionId, eventId);
    return {
      reversalTransactionId: result.reversalTransaction.transactionId,
    };
  }

  /**
   * Obtém saldo de uma conta (calculado do ledger)
   */
  async getAccountBalance(
    tenantId: string,
    accountId: string
  ): Promise<number> {
    const balance = await bankAccountService.getBalance(tenantId, accountId);
    return balance.balance;
  }

  /**
   * Obtém saldo de um usuário
   */
  async getUserBalance(
    tenantId: string,
    userId: string,
    currency: BankCurrency = 'BRL'
  ): Promise<number> {
    const account = await bankAccountService.getAccountByOwner(tenantId, userId, 'user', currency);
    if (!account) {
      return 0;
    }
    const balance = await bankAccountService.getBalance(tenantId, account.accountId);
    return balance.balance;
  }

  /**
   * Obtém saldo de um grupo
   */
  async getGroupBalance(
    tenantId: string,
    groupId: string,
    currency: BankCurrency = 'BRL'
  ): Promise<number> {
    const account = await bankAccountService.getAccountByOwner(tenantId, groupId, 'company', currency);
    if (!account) {
      return 0;
    }
    const balance = await bankAccountService.getBalance(tenantId, account.accountId);
    return balance.balance;
  }

  /**
   * Obtém saldo do organizador de evento
   */
  async getEventOrganizerBalance(
    tenantId: string,
    eventId: string,
    currency: BankCurrency = 'BRL'
  ): Promise<number> {
    const accountId = await resolveEventOrganizerAccount(tenantId, eventId, currency);
    if (!accountId) {
      return 0;
    }
    const balance = await bankAccountService.getBalance(tenantId, accountId);
    return balance.balance;
  }

  /**
   * Processa pagamento de corrida
   * Cria transação no Unify Bank com split automático (3% fee, 97% driver)
   */
  async processRidePayment(
    tenantId: string,
    input: {
      rideId: string;
      passengerUserId: string;
      driverUserId: string;
      amount: number;
      currency?: BankCurrency;
      idempotencyKey?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<{ transactionId: string; splits: Array<{ accountId: string; amount: number }> }> {
    const { rideId, passengerUserId, driverUserId, amount, currency = 'BRL', idempotencyKey, metadata } = input;

    // Resolver contas
    const passengerAccountId = await resolveUserAccount(tenantId, passengerUserId, currency);
    const driverAccountId = await resolveUserAccount(tenantId, driverUserId, currency);

    // Resolver actor do passageiro para autoria
    const { actorRepository } = await import('@modules/social/actor.repository');
    const passengerActor = await actorRepository.findOrCreateUserActor(tenantId, passengerUserId);

    // Construir autoria (ownership: passageiro é dono da conta)
    const authorship = buildFinancialAuthorshipFromRequest({
      performedByUserId: passengerUserId,
      actingForActorId: passengerActor.actor_id,
      actingForAccountId: passengerAccountId,
      authoritySource: 'ownership', // Passageiro é dono da conta origem
    });

    // Criar transação com split (ride_payment context)
    const eventIdForTransaction = idempotencyKey || uuidv4();
    const result = await bankTransactionService.createTransactionWithSplit(tenantId, {
      eventId: eventIdForTransaction,
      fromAccountId: passengerAccountId,
      amount,
      currency,
      context: 'ride_payment',
      revenueShareAccountId: driverAccountId,
      fromUserId: passengerUserId, // Para calcular referral e group allocation
      description: `Ride payment: ${rideId}`,
      metadata: {
        ...metadata,
        rideId,
        passengerUserId,
        driverUserId,
        type: 'ride_payment',
      },
      authorship,
    });

    return {
      transactionId: result.transaction.transactionId,
      splits: result.splits.map((split) => ({
        accountId: split.targetAccountId,
        amount: split.amount,
      })),
    };
  }
}

export const bankIntegrationService = new BankIntegrationService();


