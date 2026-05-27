// backend/src/modules/bank/bank-integration.service.ts
// SPRINT 3: SYSTEM INTEGRATION WITH UNIFY BANK
// Serviço de integração entre módulos e Unify Bank

import { v4 as uuidv4 } from 'uuid';
import type { PoolClient } from 'pg';
import { runQueryWithTenant } from '@core/database/pool';
import { asMoneyCents, toPositiveMoneyCents, type MoneyCents } from '@contracts/marketplace/canonical';
import { parsePositiveMoneyToCents } from './bank-http-money';
import { bankAccountService } from './bank-account.service';
import { bankTransactionService } from './bank-transaction.service';
import { requestAndExecuteReversalSync } from '../reversal/reversal.service';
import { buildFinancialAuthorshipFromRequest } from './financial-authorship.helper';
import type { BankTransactionContext } from './bank-split.types';
import type { BankCurrency } from './bank-account.types';
import { ensureUserActor } from '@modules/identity/actor-writer.service';

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
      // events.actor_id é actor_id (não user_id). resolveUserAccount espera
      // user_id porque getOrCreateAccount({ownerType: 'user'}) busca via
      // actors.user_id no repository. Tradução semântica obrigatória aqui.
      const { runQueryWithTenant } = await import('@core/database/pool');
      const actorRow = await runQueryWithTenant<{ user_id: string | null }>(
        tenantId,
        `SELECT user_id FROM actors WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
        [tenantId, event.actor_id]
      );
      const organizerUserId = actorRow?.user_id;
      if (!organizerUserId) {
        return null;
      }
      return await resolveUserAccount(tenantId, organizerUserId, currency);
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
      amountCents: number;
      currency?: BankCurrency;
      idempotencyKey?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<{ transactionId: string; splits: Array<{ accountId: string; amountCents: number }> }> {
    const { eventId, buyerUserId, currency = 'BRL', idempotencyKey, metadata } = input;
    const amountCents = parsePositiveMoneyToCents(input.amountCents, 'amountCents');

    // SPRINT 36.2: Validar limite diário (enforcement)
    try {
      const { bankLimitService } = await import('./bank-limit.service');
      await bankLimitService.validateLimit(
        tenantId,
        buyerUserId,
        'payment_out',
        amountCents,
        buyerUserId
      );
    } catch (limitError: any) {
      // Re-throw erro de limite (já tem statusCode 403)
      if (limitError.statusCode === 403) {
        throw limitError;
      }
      // Erro técnico no serviço de limites — fail-closed (não assumir permissão)
      // Sem validação de limite, não existe operação financeira.
      const svcError = new Error('[BankLimit] Serviço de limites indisponível — operação bloqueada por segurança') as any;
      svcError.statusCode = 503;
      svcError.errorCode = 'LIMIT_SERVICE_UNAVAILABLE';
      svcError.originalError = limitError?.message || String(limitError);
      throw svcError;
    }

    // Resolver conta do comprador
    const buyerAccountId = await resolveUserAccount(tenantId, buyerUserId, currency);

    // Resolver conta do organizador
    const organizerAccountId = await resolveEventOrganizerAccount(tenantId, eventId, currency);
    if (!organizerAccountId) {
      throw new Error(`Organizer account not found for event ${eventId}`);
    }

    // Resolver actor do comprador para autoria
    const buyerActor = await ensureUserActor(tenantId, buyerUserId);

    // Construir autoria (ownership: comprador é dono da conta)
    const authorship = buildFinancialAuthorshipFromRequest({
      performedByUserId: buyerUserId,
      actingForActorId: buyerActor.actor_id,
      actingForAccountId: buyerAccountId,
      authoritySource: 'ownership',
      permissionSnapshot: {
        permissionKey: 'ownership',
        allowed: true,
        actorId: buyerActor.actor_id,
        userId: buyerUserId,
        decidedAt: new Date().toISOString(),
      },
    });

    // Criar transação com split (event_ticket context)
    const eventIdForTransaction = idempotencyKey || uuidv4();
    const result = await bankTransactionService.createTransactionWithSplit(tenantId, {
      eventId: eventIdForTransaction,
      fromAccountId: buyerAccountId,
      amountCents,
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
      concept_id: 'event-ticket-payment',
    });

    return {
      transactionId: result.transaction.transactionId,
      splits: result.splits.map((split) => ({
        accountId: split.targetAccountId,
        amountCents: split.amountCents,
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
      amountCents: number;
      currency?: BankCurrency;
      idempotencyKey?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<{ transactionId: string; splits: Array<{ accountId: string; amountCents: number }> }> {
    const { eventId, buyerUserId, currency = 'BRL', idempotencyKey, metadata } = input;
    const amountCents = parsePositiveMoneyToCents(input.amountCents, 'amountCents');

    // SPRINT 36.2: Validar limite diário (enforcement)
    try {
      const { bankLimitService } = await import('./bank-limit.service');
      await bankLimitService.validateLimit(
        tenantId,
        buyerUserId,
        'payment_out',
        amountCents,
        buyerUserId
      );
    } catch (limitError: any) {
      // Re-throw erro de limite (já tem statusCode 403)
      if (limitError.statusCode === 403) {
        throw limitError;
      }
      // Erro técnico no serviço de limites — fail-closed (não assumir permissão)
      // Sem validação de limite, não existe operação financeira.
      const svcError = new Error('[BankLimit] Serviço de limites indisponível — operação bloqueada por segurança') as any;
      svcError.statusCode = 503;
      svcError.errorCode = 'LIMIT_SERVICE_UNAVAILABLE';
      svcError.originalError = limitError?.message || String(limitError);
      throw svcError;
    }

    // Resolver conta do comprador
    const buyerAccountId = await resolveUserAccount(tenantId, buyerUserId, currency);

    // Resolver conta do organizador
    const organizerAccountId = await resolveEventOrganizerAccount(tenantId, eventId, currency);
    if (!organizerAccountId) {
      throw new Error(`Organizer account not found for event ${eventId}`);
    }

    // Resolver actor do comprador para autoria
    const buyerActor = await ensureUserActor(tenantId, buyerUserId);

    // Construir autoria (ownership: comprador é dono da conta)
    const authorship = buildFinancialAuthorshipFromRequest({
      performedByUserId: buyerUserId,
      actingForActorId: buyerActor.actor_id,
      actingForAccountId: buyerAccountId,
      authoritySource: 'ownership',
      permissionSnapshot: {
        permissionKey: 'ownership',
        allowed: true,
        actorId: buyerActor.actor_id,
        userId: buyerUserId,
        decidedAt: new Date().toISOString(),
      },
    });

    // Criar transação com split (event_ticket context - mesmo split de ingresso)
    const eventIdForTransaction = idempotencyKey || uuidv4();
    const result = await bankTransactionService.createTransactionWithSplit(tenantId, {
      eventId: eventIdForTransaction,
      fromAccountId: buyerAccountId,
      amountCents,
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
      concept_id: 'event-ticket-payment',
    });

    return {
      transactionId: result.transaction.transactionId,
      splits: result.splits.map((split) => ({
        accountId: split.targetAccountId,
        amountCents: split.amountCents,
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
      amountCents: number;
      currency?: BankCurrency;
      idempotencyKey?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<{ transactionId: string; splits: Array<{ accountId: string; amountCents: number }> }> {
    const { bookingId, serviceId, buyerUserId, providerUserId, currency = 'BRL', idempotencyKey, metadata } = input;
    const amountCents = parsePositiveMoneyToCents(input.amountCents, 'amountCents');

    // SPRINT 36.2: Validar limite diário (enforcement)
    try {
      const { bankLimitService } = await import('./bank-limit.service');
      await bankLimitService.validateLimit(
        tenantId,
        buyerUserId,
        'payment_out',
        amountCents,
        buyerUserId
      );
    } catch (limitError: any) {
      // Re-throw erro de limite (já tem statusCode 403)
      if (limitError.statusCode === 403) {
        throw limitError;
      }
      // Erro técnico no serviço de limites — fail-closed (não assumir permissão)
      // Sem validação de limite, não existe operação financeira.
      const svcError = new Error('[BankLimit] Serviço de limites indisponível — operação bloqueada por segurança') as any;
      svcError.statusCode = 503;
      svcError.errorCode = 'LIMIT_SERVICE_UNAVAILABLE';
      svcError.originalError = limitError?.message || String(limitError);
      throw svcError;
    }

    // Resolver contas
    const buyerAccountId = await resolveUserAccount(tenantId, buyerUserId, currency);
    const providerAccountId = await resolveUserAccount(tenantId, providerUserId, currency);

    // Resolver actor do comprador para autoria
    const buyerActor = await ensureUserActor(tenantId, buyerUserId);

    // Construir autoria (ownership: comprador é dono da conta)
    const authorship = buildFinancialAuthorshipFromRequest({
      performedByUserId: buyerUserId,
      actingForActorId: buyerActor.actor_id,
      actingForAccountId: buyerAccountId,
      authoritySource: 'ownership',
      permissionSnapshot: {
        permissionKey: 'ownership',
        allowed: true,
        actorId: buyerActor.actor_id,
        userId: buyerUserId,
        decidedAt: new Date().toISOString(),
      },
    });

    // Criar transação com split (service_booking context)
    const eventIdForTransaction = idempotencyKey || uuidv4();
    const result = await bankTransactionService.createTransactionWithSplit(tenantId, {
      eventId: eventIdForTransaction,
      fromAccountId: buyerAccountId,
      amountCents,
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
      concept_id: 'service-booking-payment',
    });

    return {
      transactionId: result.transaction.transactionId,
      splits: result.splits.map((split) => ({
        accountId: split.targetAccountId,
        amountCents: split.amountCents,
      })),
    };
  }

  /**
   * Conta bank para actor (user / page+company / group).
   */
  private async resolveBankAccountForServiceActor(
    tenantId: string,
    actorId: string,
    currency: BankCurrency = 'BRL'
  ): Promise<string> {
    const { actorRepository } = await import('@modules/social/actor.repository');
    const actor = await actorRepository.findById(tenantId, actorId);
    if (!actor) {
      throw new Error(`Actor not found: ${actorId}`);
    }
    if (actor.actor_type === 'user' && actor.user_id) {
      return resolveUserAccount(tenantId, actor.user_id, currency);
    }
    if (actor.actor_type === 'page' && actor.company_id) {
      return resolveCompanyAccount(tenantId, actor.company_id, currency);
    }
    if (actor.actor_type === 'group' && actor.group_id) {
      return resolveGroupAccount(tenantId, actor.group_id, currency);
    }
    throw new Error(
      `Cannot resolve bank account for actor ${actorId} type ${actor.actor_type}`
    );
  }

  /**
   * Execução de pagamento de serviço: uma bank_transaction + bank_splits explícitos por execução.
   *
   * PE-3 (2026-05-26 — DECISION-0048): `splitRecipients` agora aceita `destinationAccountId`
   * e `splitType` opcionais. Quando ausentes, força destino `escrow_payments` + splitType
   * `'revenue_share'` (compat legacy). Quando fornecidos pelo caller (resolver de policy),
   * permite splits heterogêneos no MESMO bank_transaction:
   *   - revenue_share → escrow_payments (espera D-money liberar para actor_wallet)
   *   - platform_fee  → platform_fees system
   *   - regional_fund → regional_fund system account
   *   - reserve       → risk_reserve system
   *   - etc.
   *
   * Atomicidade: todos os splits (heterogêneos ou não) entram na MESMA transação SQL
   * via `createTransactionWithExplicitSplitLines` — bank_ledger continua double-entry
   * (debit do payer + N credits nos destinos = total bruto).
   */
  async processServicePaymentExecutionCanonical(
    tenantId: string,
    input: {
      paymentRequestId: string;
      executionId: string;
      payerUserId: string;
      payerActorId: string;
      amountCents: number;
      currency?: BankCurrency;
      splitRecipients: Array<{
        receiverActorId: string;
        amountCents: number;
        percentage?: number | null;
        /** PE-3: destino do split. Quando ausente, força escrow_payments (compat legacy). */
        destinationAccountId?: string;
        /** PE-3: tipo do split. Quando ausente, força 'revenue_share' (compat legacy). */
        splitType?: 'fee' | 'regional_fund' | 'reserve' | 'escrow' | 'revenue_share' | 'referral';
      }>;
      metadata?: Record<string, any>;
    },
    /**
     * OUTBOX_ATOMICITY_HARDENING (Opção A): aceita client externo já com
     * BEGIN aberto. Propaga para createTransactionWithExplicitSplitLines
     * (a única ESCRITA do método). Os READS de validação (validateLimit,
     * resolveAccount, concept_id) continuam fora da transação — são
     * consultas sobre estado já comitado e não precisam do client da tx.
     */
    existingClient?: PoolClient
  ): Promise<{
    transactionId: string;
    /**
     * Splits agregados (matching splitLines × bank result) prontos para
     * emissão de SERVICE_PAYMENT_SPLIT_APPLIED no outbox, sem releitura
     * de banco — campos exatos que o caller (createExecution) precisa.
     */
    splits: Array<{
      splitId: string;
      receiverActorId: string;
      amountCents: number;
      percentage: number | null;
    }>;
  }> {
    const {
      paymentRequestId,
      executionId,
      payerUserId,
      payerActorId,
      currency = 'BRL',
      splitRecipients,
      metadata = {},
    } = input;
    const amountCents = parsePositiveMoneyToCents(input.amountCents, 'amountCents');

    try {
      const { bankLimitService } = await import('./bank-limit.service');
      await bankLimitService.validateLimit(
        tenantId,
        payerUserId,
        'payment_out',
        amountCents,
        payerUserId
      );
    } catch (limitError: unknown) {
      const err = limitError as { statusCode?: number; message?: string };
      if (err.statusCode === 403) {
        throw limitError;
      }
      // Erro técnico no serviço de limites — fail-closed (não assumir permissão)
      // Sem validação de limite, não existe operação financeira.
      const svcError = new Error('[BankLimit] Serviço de limites indisponível — operação bloqueada por segurança') as any;
      svcError.statusCode = 503;
      svcError.errorCode = 'LIMIT_SERVICE_UNAVAILABLE';
      svcError.originalError = err?.message || String(limitError);
      throw svcError;
    }

    const fromAccountId = await resolveUserAccount(tenantId, payerUserId, currency);

    // ============================================================
    // CAMADA 1 — ENTRADA EM ESCROW (Decisão Clayton D1', D1'', D1''')
    // ============================================================
    // Pagamento de serviço de preço fechado credita custódia ÚNICA
    // (escrow_payments, owner=system) — NÃO a conta sacável do receiver.
    //
    // Regra econômica: "pagamento recebido NÃO significa saque liberado".
    //
    // Modelo MVP — escrow AGREGADO (D1''):
    //   - Todos os splitLines apontam para a MESMA conta escrow_payments.
    //   - Rastreabilidade por receiver preservada via metadata em
    //     bank_ledger.metadata.receiverActorId (bank-transaction.service.ts
    //     L1607-1610) + bank_splits.metadata.receiverActorId
    //     (idem L1630-1633).
    //   - bank_splits.target_account_id = escrow_payments (mesma para
    //     todas as linhas); target_actor_id resolve para NULL (escrow é
    //     system, sem actor associado — comportamento normal de
    //     resolveTargetActorIdOptional em bank-split.repository.ts:40-57).
    //
    // Dívida consciente registrada: subcontas por receiver podem ser
    // exigidas no futuro por compliance. Ver DT-CAMADA1-ENTRADA-ESCROW.
    //
    // Convergência com marketplace (D1'''): mesma conta system
    // escrow_payments do executePayment (payment-execution.service.ts
    // L404-408). NÃO duplicar custódia; reusar a já existente.
    //
    // ensurePlatformAccounts garante que escrow_payments exista no tenant.
    // ============================================================
    await bankAccountService.ensurePlatformAccounts(tenantId, currency);
    const escrowAccount = await bankAccountService.getPlatformLifecycleAccount(
      tenantId,
      'escrow_payments',
      currency
    );
    if (!escrowAccount) {
      throw new Error(
        'CAMADA_1_ENTRY: conta escrow_payments do tenant não encontrada — ' +
          'ensurePlatformAccounts deveria ter criado. Verificar bootstrap do tenant.'
      );
    }
    const escrowAccountId = escrowAccount.accountId;

    const splitLines: Array<{
      targetAccountId: string;
      amountCents: number;
      percentage?: number | null;
      receiverActorId: string;
      splitType?: 'fee' | 'regional_fund' | 'reserve' | 'escrow' | 'revenue_share' | 'referral';
    }> = [];
    for (const r of splitRecipients) {
      // Validar receiverActorId APENAS quando fornecido (system splits — fee,
      // regional_fund, reserve — não têm actor receptor; receiverActorId vem
      // como '' do caller PE-3).
      if (r.receiverActorId) {
        const { actorRepository } = await import('@modules/social/actor.repository');
        const actor = await actorRepository.findById(tenantId, r.receiverActorId);
        if (!actor) {
          throw new Error(`Actor not found: ${r.receiverActorId}`);
        }
      }
      splitLines.push({
        // PE-3: destinationAccountId quando fornecido pelo resolver de policy;
        // senão escrow_payments (compat legacy quando caller passa input.splits).
        targetAccountId: r.destinationAccountId ?? escrowAccountId,
        amountCents: parsePositiveMoneyToCents(r.amountCents, 'splitRecipients[].amountCents'),
        percentage: r.percentage,
        receiverActorId: r.receiverActorId,
        splitType: r.splitType ?? 'revenue_share',
      });
    }

    const buyerActor = await ensureUserActor(tenantId, payerUserId);
    const authorship = buildFinancialAuthorshipFromRequest({
      performedByUserId: payerUserId,
      actingForActorId: buyerActor.actor_id,
      actingForAccountId: fromAccountId,
      authoritySource: 'ownership',
      permissionSnapshot: {
        permissionKey: 'ownership',
        allowed: true,
        actorId: buyerActor.actor_id,
        userId: payerUserId,
        decidedAt: new Date().toISOString(),
      },
    });

    // Resolver UUID do concept via SSOT semantico.
    // 'ride-payment' e o slug canonico no dominio 'financeiro-payment'.
    // runQueryWithTenant retorna o primeiro row diretamente (ver pool.ts:190).
    const conceptRow = await runQueryWithTenant<{ concept_id: string }>(
      tenantId,
      `SELECT concept_id FROM concepts WHERE domain = $1 AND slug = $2 LIMIT 1`,
      ['financeiro-payment', 'ride-payment']
    );
    if (!conceptRow) {
      throw new Error('CONCEPT_NOT_FOUND: ride-payment em financeiro-payment nao encontrado');
    }

    const result = await bankTransactionService.createTransactionWithExplicitSplitLines(
      tenantId,
      {
        referenceType: 'service_execution',
        referenceId: paymentRequestId,
        fromAccountId,
        payerActorId,
        amountCents,
        currency,
        splitLines,
        description: `Service payment request ${paymentRequestId}`,
        metadata: { ...metadata, executionId, paymentRequestId },
        concept_id: conceptRow.concept_id,
        authorship,
      },
      existingClient
    );

    // OUTBOX_ATOMICITY_HARDENING: agregar splits no formato que createExecution
    // precisa para emitir SERVICE_PAYMENT_SPLIT_APPLIED (splitId vem do bank;
    // receiverActorId vem do splitLines local, posição por posição). Match por
    // índice é seguro porque o bank itera splitLines na ordem fornecida
    // (bank-transaction.service.ts L1572 LOOP `for (const line of splitLines)`).
    const splits = result.splits.map((bankSplit, idx) => ({
      splitId: bankSplit.splitId,
      receiverActorId: splitLines[idx]!.receiverActorId,
      amountCents: bankSplit.amountCents,
      percentage: bankSplit.percentage ?? null,
    }));

    return {
      transactionId: result.transaction.transactionId,
      splits,
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
      amountCents: number;
      currency?: BankCurrency;
      idempotencyKey?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<{ transactionId: string }> {
    const { groupId, contributorUserId, currency = 'BRL', idempotencyKey, metadata } = input;
    const amountCents = parsePositiveMoneyToCents(input.amountCents, 'amountCents');

    // Resolver contas
    const contributorAccountId = await resolveUserAccount(tenantId, contributorUserId, currency);
    const groupAccountId = await resolveGroupAccount(tenantId, groupId, currency);

    // Resolver actor do contribuidor para autoria
    const contributorActor = await ensureUserActor(tenantId, contributorUserId);

    // Construir autoria (ownership: contribuidor é dono da conta)
    const authorship = buildFinancialAuthorshipFromRequest({
      performedByUserId: contributorUserId,
      actingForActorId: contributorActor.actor_id,
      actingForAccountId: contributorAccountId,
      authoritySource: 'ownership',
      permissionSnapshot: {
        permissionKey: 'ownership',
        allowed: true,
        actorId: contributorActor.actor_id,
        userId: contributorUserId,
        decidedAt: new Date().toISOString(),
      },
    });

    // Criar transação com split (group_contribution context)
    const eventIdForTransaction = idempotencyKey || uuidv4();
    const result = await bankTransactionService.createTransactionWithSplit(tenantId, {
      eventId: eventIdForTransaction,
      fromAccountId: contributorAccountId,
      amountCents,
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
      concept_id: 'group-contribution-payment',
    });

    return {
      transactionId: result.transaction.transactionId,
    };
  }

  /**
   * Reversão formal (Prompt 51.1): motor de reversal + PaymentIntent de pipeline.
   */
  async reverseTransaction(
    tenantId: string,
    transactionId: string,
    eventId?: string,
    actorId?: string
  ): Promise<{ reversalTransactionId: string; reversalTransactionIds?: string[] }> {
    const row = await runQueryWithTenant<{ amount_cents: string }>(
      tenantId,
      `SELECT amount_cents::text FROM bank_transactions WHERE tenant_id = $1 AND id = $2`,
      [tenantId, transactionId]
    );
    if (!row) throw new Error(`Transaction ${transactionId} not found`);
    const amountCents = toPositiveMoneyCents(parseInt(String(row.amount_cents), 10));
    let act = actorId;
    if (!act) {
      const a = await runQueryWithTenant<{ id: string }>(
        tenantId,
        `SELECT id FROM actors WHERE tenant_id = $1 ORDER BY created_at ASC LIMIT 1`,
        [tenantId]
      );
      act = a?.id;
    }
    if (!act) throw new Error('NO_ACTOR_FOR_REVERSAL');
    const result = await requestAndExecuteReversalSync(tenantId, {
      originalTransactionId: transactionId,
      actorId: act,
      reason: `bridge_reverseTransaction:${eventId ?? uuidv4()}`,
      amountCents,
      // DECISION-0052: bridge sistêmico — provider externo / fluxo automático.
      reversalType: 'external_reversal',
      authoritySource: 'system',
    });
    return {
      reversalTransactionId: result.reversalTransactionId,
      reversalTransactionIds: result.reversalTransactionIds,
    };
  }

  /**
   * Obtém saldo de uma conta (calculado do ledger)
   * @returns Centavos inteiros (§4.7).
   */
  async getAccountBalance(tenantId: string, accountId: string): Promise<MoneyCents> {
    const balance = await bankAccountService.getBalance(tenantId, accountId);
    return asMoneyCents(balance.balanceCents);
  }

  /**
   * Obtém saldo de um usuário
   * @returns Centavos inteiros (§4.7).
   */
  async getUserBalance(
    tenantId: string,
    userId: string,
    currency: BankCurrency = 'BRL'
  ): Promise<MoneyCents> {
    const account = await bankAccountService.getAccountByOwner(tenantId, userId, 'user', currency);
    if (!account) {
      return asMoneyCents(0);
    }
    const balance = await bankAccountService.getBalance(tenantId, account.accountId);
    return asMoneyCents(balance.balanceCents);
  }

  /**
   * Obtém saldo de um grupo
   * @returns Centavos inteiros (§4.7).
   */
  async getGroupBalance(
    tenantId: string,
    groupId: string,
    currency: BankCurrency = 'BRL'
  ): Promise<MoneyCents> {
    const account = await bankAccountService.getAccountByOwner(tenantId, groupId, 'company', currency);
    if (!account) {
      return asMoneyCents(0);
    }
    const balance = await bankAccountService.getBalance(tenantId, account.accountId);
    return asMoneyCents(balance.balanceCents);
  }

  /**
   * 2026-05-18 P1 — Bank actor-context.
   * Obtém saldo de um actor (user/page/group/channel).
   * Resolve actor → owner apropriado via `actors` table → conta bank.
   *
   * Authority do user sobre o actor DEVE ser validada pelo caller ANTES
   * (via actorCapabilitiesService.resolveForUser). Este método apenas
   * resolve actor → conta e consulta saldo.
   *
   * @returns Centavos inteiros (§4.7). Retorna 0 se actor não tem conta.
   */
  async getActorBalance(
    tenantId: string,
    actorId: string,
    currency: BankCurrency = 'BRL'
  ): Promise<MoneyCents> {
    const actorRow = await runQueryWithTenant<{
      actor_type: string;
      user_id: string | null;
      company_id: string | null;
      group_id: string | null;
    }>(
      tenantId,
      `
      SELECT actor_type, user_id, company_id, group_id
      FROM actors
      WHERE tenant_id = $1 AND actor_id = $2
      LIMIT 1
      `,
      [tenantId, actorId]
    );
    if (!actorRow) {
      return asMoneyCents(0);
    }

    if (actorRow.actor_type === 'user' && actorRow.user_id) {
      return await this.getUserBalance(tenantId, actorRow.user_id, currency);
    }
    if (actorRow.actor_type === 'page' && actorRow.company_id) {
      const account = await bankAccountService.getAccountByOwner(
        tenantId,
        actorRow.company_id,
        'company',
        currency
      );
      if (!account) return asMoneyCents(0);
      const balance = await bankAccountService.getBalance(tenantId, account.accountId);
      return asMoneyCents(balance.balanceCents);
    }
    if (actorRow.actor_type === 'group' && actorRow.group_id) {
      return await this.getGroupBalance(tenantId, actorRow.group_id, currency);
    }
    // channel não tem conta dedicada hoje — retorna 0
    return asMoneyCents(0);
  }

  /**
   * Obtém saldo do organizador de evento
   * @returns Centavos inteiros (§4.7).
   */
  async getEventOrganizerBalance(
    tenantId: string,
    eventId: string,
    currency: BankCurrency = 'BRL'
  ): Promise<MoneyCents> {
    const accountId = await resolveEventOrganizerAccount(tenantId, eventId, currency);
    if (!accountId) {
      return asMoneyCents(0);
    }
    const balance = await bankAccountService.getBalance(tenantId, accountId);
    return asMoneyCents(balance.balanceCents);
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
      amountCents: number;
      currency?: BankCurrency;
      idempotencyKey?: string;
      groupId?: string;
      referrerUserId?: string;
      region?: { country: string; state: string; city: string };
      metadata?: Record<string, any>;
    }
  ): Promise<{
    transactionId: string;
    splits: Array<{ accountId: string; amountCents: number; splitType: string }>;
  }> {
    const {
      rideId,
      passengerUserId,
      driverUserId,
      currency = 'BRL',
      idempotencyKey,
      metadata,
      groupId,
      referrerUserId,
      region,
    } = input;
    const amountCents = toPositiveMoneyCents(input.amountCents);

    try {
      const { bankLimitService } = await import('./bank-limit.service');
      await bankLimitService.validateLimit(
        tenantId,
        passengerUserId,
        'payment_out',
        amountCents,
        passengerUserId
      );
    } catch (limitError: any) {
      if (limitError.statusCode === 403) {
        throw limitError;
      }
      // Erro técnico no serviço de limites — fail-closed (não assumir permissão)
      // Sem validação de limite, não existe operação financeira.
      const svcError = new Error('[BankLimit] Serviço de limites indisponível — operação bloqueada por segurança') as any;
      svcError.statusCode = 503;
      svcError.errorCode = 'LIMIT_SERVICE_UNAVAILABLE';
      svcError.originalError = limitError?.message || String(limitError);
      throw svcError;
    }

    const passengerAccountId = await resolveUserAccount(tenantId, passengerUserId, currency);
    const driverAccountId = await resolveUserAccount(tenantId, driverUserId, currency);
    const feeAccount = await bankAccountService.getSystemAccount(tenantId, 'fee', currency);
    if (!feeAccount) {
      throw new Error('Fee account not found');
    }

    let regionalFundAccountId: string | null = null;
    if (region) {
      const regionalFundAccount = await bankAccountService.ensureRegionalFundBankAccountForRegion(
        tenantId,
        region,
        currency
      );
      regionalFundAccountId = regionalFundAccount.accountId;
    }

    let groupAccountId: string | null = null;
    if (groupId) {
      groupAccountId = await resolveGroupAccount(tenantId, groupId, currency);
    }

    let referrerAccountId: string | null = null;
    if (referrerUserId) {
      referrerAccountId = await resolveUserAccount(tenantId, referrerUserId, currency);
    }

    const feeCents = Math.round(amountCents * 0.03);
    const regionalCents = regionalFundAccountId ? Math.round(amountCents * 0.1) : 0;
    const groupCents = groupAccountId ? Math.round(amountCents * 0.1) : 0;
    const referralCents = referrerAccountId ? Math.round(amountCents * 0.07) : 0;
    const driverBaseCents = Math.round(amountCents * 0.7);
    const remainderCents =
      amountCents - driverBaseCents - feeCents - regionalCents - groupCents - referralCents;
    const driverTotalCents = driverBaseCents + remainderCents;

    const passengerActor = await ensureUserActor(tenantId, passengerUserId);
    const driverActor = await ensureUserActor(tenantId, driverUserId);
    const referrerActor = referrerUserId
      ? await ensureUserActor(tenantId, referrerUserId)
      : null;

    const authorship = buildFinancialAuthorshipFromRequest({
      performedByUserId: passengerUserId,
      actingForActorId: passengerActor.actor_id,
      actingForAccountId: passengerAccountId,
      authoritySource: 'ownership',
      permissionSnapshot: {
        permissionKey: 'ownership',
        allowed: true,
        actorId: passengerActor.actor_id,
        userId: passengerUserId,
        decidedAt: new Date().toISOString(),
      },
    });

    const splitLines: Array<{
      targetAccountId: string;
      amountCents: number;
      percentage?: number | null;
      receiverActorId: string;
      splitType?: 'revenue_share' | 'fee' | 'regional_fund' | 'referral';
    }> = [
      {
        targetAccountId: driverAccountId,
        amountCents: driverTotalCents,
        percentage: driverTotalCents / amountCents,
        receiverActorId: driverActor.actor_id,
        splitType: 'revenue_share',
      },
      {
        targetAccountId: feeAccount.accountId,
        amountCents: feeCents,
        percentage: feeCents / amountCents,
        receiverActorId: feeAccount.accountId,
        splitType: 'fee',
      },
    ];

    if (regionalFundAccountId && regionalCents > 0) {
      splitLines.push({
        targetAccountId: regionalFundAccountId,
        amountCents: regionalCents,
        percentage: regionalCents / amountCents,
        receiverActorId: regionalFundAccountId,
        splitType: 'regional_fund',
      });
    }

    if (groupAccountId && groupCents > 0) {
      splitLines.push({
        targetAccountId: groupAccountId,
        amountCents: groupCents,
        percentage: groupCents / amountCents,
        receiverActorId: groupAccountId,
        splitType: 'revenue_share',
      });
    }

    if (referrerAccountId && referralCents > 0) {
      splitLines.push({
        targetAccountId: referrerAccountId,
        amountCents: referralCents,
        percentage: referralCents / amountCents,
        receiverActorId: referrerActor?.actor_id ?? referrerAccountId,
        splitType: 'referral',
      });
    }

    const result = await bankTransactionService.createTransactionWithExplicitSplitLines(tenantId, {
      referenceType: 'ride_payment',
      referenceId: rideId,
      fromAccountId: passengerAccountId,
      payerActorId: passengerActor.actor_id,
      amountCents,
      currency,
      splitLines,
      description: `Corrida ${rideId}`,
      metadata: {
        rideId,
        passengerUserId,
        driverUserId,
        type: 'ride_payment',
        idempotencyKey: idempotencyKey ?? `ride-${rideId}`,
        split: {
          driver_cents: driverTotalCents,
          fee_cents: feeCents,
          regional_fund_cents: regionalCents,
          group_cents: groupCents,
          referral_cents: referralCents,
        },
        region,
        groupId,
        referrerUserId,
        ...metadata,
      },
      concept_id: 'ride-payment',
      authorship,
    });

    return {
      transactionId: result.transaction.transactionId,
      splits: result.splits.map((split) => ({
        accountId: split.targetAccountId,
        amountCents: split.amountCents,
        splitType: split.splitType,
      })),
    };
  }
}

export const bankIntegrationService = new BankIntegrationService();



