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
import { assertCheckoutFinancialRuntimeEnabled } from '@core/checkout/checkout-financial-firewall';
import { assertRidesFinancialRuntimeEnabled } from '@core/rides/rides-financial-firewall';
import type { BankSplitType, BankTransactionContext } from './bank-split.types';
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
    _tenantId: string,
    _input: {
      eventId: string;
      buyerUserId: string;
      amountCents: number;
      currency?: BankCurrency;
      idempotencyKey?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<{ transactionId: string; splits: Array<{ accountId: string; amountCents: number }> }> {
    // 🔴 F-BANK-SPLIT-PIPELINE-CONSOLIDATION Fase 1D (DECISION-0165 D5/D8, sistema virgem):
    //    event_ticket RETIRADO — fora do MVP. Corpo legado (createTransactionWithSplit context
    //    'event_ticket' → bankSplitEngine = split fora do Bank) REMOVIDO. Fail-closed 501 no topo
    //    absoluto — GATE de call-graph provou que nenhum caller persiste estado antes do sink
    //    (CheckoutService transacional→rollback · event-economy firewall no topo · events-payment sem
    //    mutação antes). Reabrir = pipeline canônico (economic_policy_engine → bank-transaction.service
    //    → bank_splits), frente própria com GO.
    throw Object.assign(
      new Error(
        'EVENT_TICKET_PAYMENT_RETIRED: pagamento de ingresso de evento fora do MVP (DECISION-0165). ' +
          'Reabre só pelo pipeline canônico.',
      ),
      { statusCode: 501 },
    );
  }

  /**
   * Processa pagamento de consumo em evento
   * Cria transação no Unify Bank com split automático
   */
  async processEventConsumptionPayment(
    _tenantId: string,
    _input: {
      eventId: string;
      buyerUserId: string;
      amountCents: number;
      currency?: BankCurrency;
      idempotencyKey?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<{ transactionId: string; splits: Array<{ accountId: string; amountCents: number }> }> {
    // 🔴 F-BANK-SPLIT-PIPELINE-CONSOLIDATION Fase 1D (DECISION-0165 D5/D8, sistema virgem):
    //    event_ticket (consumo) RETIRADO — fora do MVP. Corpo legado (createTransactionWithSplit
    //    context 'event_ticket' → bankSplitEngine = split fora do Bank) REMOVIDO. Fail-closed 501 no
    //    topo absoluto — GATE de call-graph: único caller CheckoutService é transacional → rollback;
    //    nada persiste antes do sink. Reabrir = pipeline canônico, com GO.
    throw Object.assign(
      new Error(
        'EVENT_CONSUMPTION_PAYMENT_RETIRED: pagamento de consumo de evento fora do MVP (DECISION-0165). ' +
          'Reabre só pelo pipeline canônico.',
      ),
      { statusCode: 501 },
    );
  }

  // ========================================================
  // 🔴 processServiceBookingPayment REMOVIDO — F-BANK-SPLIT-PIPELINE-CONSOLIDATION Fase 1C
  //    (DECISION-0165 D5/D8, sistema virgem). Era o RAMO LEGADO de service_booking: chamava
  //    createTransactionWithSplit (context 'service_booking' → bankSplitEngine = split fora do Bank).
  //    Estava MORTO (zero callers — provado no GATE). service_booking permanece MVP e VIVO pelo
  //    CANÔNICO: service-payment-execution.service → economicPolicyEngine →
  //    processServicePaymentExecutionCanonical → createTransactionWithExplicitSplitLines → bank_splits.
  //    Removido SÓ o legado; o canônico não foi tocado. (Helper morto irmão
  //    `resolveBankAccountForServiceActor` — sem caller — anotado para sweep de código morto.)
  // ========================================================

  // 🔴 resolveBankAccountForServiceActor REMOVIDO — F-BANK-SPLIT-PIPELINE-CONSOLIDATION Fase 1E-2
  //    (sweep de código morto financeiro): helper do ramo legado service_booking (1C), sem caller
  //    vivo (provado no GATE). resolveEventOrganizerAccount NÃO foi tocado (tem caller vivo:
  //    getEventOrganizerBalance).

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
        splitType?: BankSplitType;
        /** Fase 2c (DECISION-0166 D5): jurisdição por FK da linha regional_fund; demais null. */
        jurisdictionSnapshot?: Record<string, unknown> | null;
      }>;
      metadata?: Record<string, any>;
      /**
       * DECISION-0166 D5 (F1-c): id da VERSÃO de economic_policies que decidiu os
       * splits (repassado a bank_splits.policy_version_id). null = caminho legado
       * sem policy canônica.
       */
      policyVersionId?: string | null;
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
      splitType?: BankSplitType;
      jurisdictionSnapshot?: Record<string, unknown> | null;
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
        jurisdictionSnapshot: r.jurisdictionSnapshot ?? null,
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
        policyVersionId: input.policyVersionId ?? null,
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
    actorId?: string,
    existingClient?: PoolClient
  ): Promise<{ reversalTransactionId: string; reversalTransactionIds?: string[] }> {
    // FISCAL-4E (PASSE 3R): existingClient repassado ao motor formal → a reversão Bank ocorre na MESMA
    // transação DONA do chamador (atomicidade com o evento fiscal de reversão; sem commit interno).
    const row = existingClient
      ? ((await existingClient.query<{ amount_cents: string }>(
          `SELECT amount_cents::text FROM bank_transactions WHERE tenant_id = $1 AND id = $2`,
          [tenantId, transactionId]
        )).rows[0] ?? undefined)
      : await runQueryWithTenant<{ amount_cents: string }>(
          tenantId,
          `SELECT amount_cents::text FROM bank_transactions WHERE tenant_id = $1 AND id = $2`,
          [tenantId, transactionId]
        );
    if (!row) throw new Error(`Transaction ${transactionId} not found`);
    const amountCents = toPositiveMoneyCents(parseInt(String(row.amount_cents), 10));
    let act = actorId;
    if (!act) {
      const a = existingClient
        ? ((await existingClient.query<{ id: string }>(
            `SELECT id FROM actors WHERE tenant_id = $1 ORDER BY created_at ASC LIMIT 1`,
            [tenantId]
          )).rows[0] ?? undefined)
        : await runQueryWithTenant<{ id: string }>(
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
    }, existingClient);
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
    _tenantId: string,
    _input: {
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
    // 🔴 F-BANK-SPLIT-PIPELINE-CONSOLIDATION Fase 1D (DECISION-0165 D5/D8, sistema virgem):
    //    ride_payment RETIRADO — fora do MVP. Corpo legado (split 3/10/10/7/70 HARDCODED via
    //    createTransactionWithExplicitSplitLines, referenceType/context 'ride_payment') REMOVIDO.
    //    Fail-closed 501 no topo absoluto — GATE de call-graph provou: distribution.service (único
    //    caller do sink) tem firewall no topo e só faz SELECT antes; nada persiste antes deste ponto.
    //    Reabrir = pipeline canônico (economic_policy_engine → bank-transaction.service → bank_splits),
    //    frente própria com GO.
    throw Object.assign(
      new Error(
        'RIDE_PAYMENT_RETIRED: pagamento de corrida fora do MVP (DECISION-0165). ' +
          'Reabre só pelo pipeline canônico.',
      ),
      { statusCode: 501 },
    );
  }
}

export const bankIntegrationService = new BankIntegrationService();



