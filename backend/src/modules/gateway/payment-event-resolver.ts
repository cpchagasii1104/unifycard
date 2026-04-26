// Payment Event Resolver — transforma eventos de gateway em mutações de pagamento.
// Settlement hardening: settlement apenas marca external_settled_at com lock + validações.

import { v4 as uuidv4 } from 'uuid';
import type { PoolClient } from 'pg';
import { enqueueReconciliation, type PaymentEvent } from '@core/events/payment-events-queue';
import { bankAccountService } from '../bank/bank-account.service';
import { bankTransactionService } from '../bank/bank-transaction.service';
import { buildSystemAuthorship } from '../bank/financial-authorship.helper';
import type { BankCurrency } from '../bank/bank-account.types';
import type { PaymentIntent } from '@modules/payments/payment-intent-repository';
import {
  getPaymentIntentByReference,
  updatePaymentIntentStatus,
  updatePaymentIntentMetadata,
} from '@modules/payments/payment-intent-repository';

/**
 * Settlement: escrowed → settled.
 * Regra: não cria escrita financeira (sem ledger/transaction); apenas marca external_settled_at.
 * @param client - Quando informado, roda na mesma transação (consistência + anti-double-spend).
 */
export async function settleEscrowedPaymentIntent(
  tenantId: string,
  intent: PaymentIntent,
  client?: PoolClient
): Promise<void> {
  if (intent.status !== 'escrowed') {
    return;
  }
  const externalAmountCents = resolveExternalAmountCents(intent);
  const ledgerAmountCents = intent.amountCents;
  if (externalAmountCents !== ledgerAmountCents) {
    throw new Error('SETTLEMENT_AMOUNT_MISMATCH');
  }
  await assertSettlementExecutionAllowed(tenantId, intent, client);
  await markReferenceExternallySettled(tenantId, intent, client);
  await updatePaymentIntentMetadata(tenantId, intent.id, {
    settlement_reference: intent.referenceId,
  });
  await updatePaymentIntentStatus(tenantId, intent.id, 'settled');
  console.log('PAYMENT_INTENT_SETTLED');
}

function resolveExternalAmountCents(intent: PaymentIntent): number {
  const metadata = intent.metadata ?? {};
  const candidates = [
    metadata.external_amount_cents,
    metadata.externalAmountCents,
    metadata.gateway_amount_cents,
    metadata.gatewayAmountCents,
    metadata.amount_cents,
    metadata.amountCents,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
    if (typeof candidate === 'string' && candidate.trim() !== '' && !Number.isNaN(Number(candidate))) {
      return Number(candidate);
    }
  }
  return intent.amountCents;
}

async function assertSettlementExecutionAllowed(
  tenantId: string,
  intent: PaymentIntent,
  client?: PoolClient
): Promise<void> {
  const queryable = client ?? null;
  if (!queryable) {
    return;
  }

  // Lock pessimista do alvo lógico antes da execução.
  await queryable.query(
    `SELECT id
     FROM payment_intents
     WHERE tenant_id = $1 AND id = $2
     FOR UPDATE`,
    [tenantId, intent.id]
  );

  // Trava física de execução: primeira execução grava lock; repetição falha por unique.
  try {
    await queryable.query(
      `INSERT INTO payment_execution_lock (reference_id, type)
       VALUES ($1::uuid, $2)`,
      [intent.id, 'settlement']
    );
  } catch (err) {
    if ((err as { code?: string })?.code === '23505') {
      throw new Error('SETTLEMENT_EXECUTION_LOCKED');
    }
    throw err;
  }

  // Se já existe settlement externo para a referência, aborta.
  const existingSettlement = await queryable.query<{ external_settled_at: Date | null }>(
    `SELECT external_settled_at
     FROM bank_transactions
     WHERE tenant_id = $1
       AND reference_id = $2
     ORDER BY created_at DESC
     LIMIT 1
     FOR UPDATE`,
    [tenantId, intent.referenceId]
  );
  if (existingSettlement.rows[0]?.external_settled_at) {
    throw new Error('SETTLEMENT_ALREADY_EXTERNALLY_SETTLED');
  }
}

async function markReferenceExternallySettled(
  tenantId: string,
  intent: PaymentIntent,
  client?: PoolClient
): Promise<void> {
  if (!client) {
    return;
  }
  const settled = await bankTransactionService.markExternallySettledByReference(
    tenantId,
    intent.referenceId,
    client
  );
  if (!settled) {
    throw new Error('SETTLEMENT_REFERENCE_NOT_FOUND');
  }
}

/**
 * Release: settled → completed. Transfere seller_pending → seller_available via bankTransactionService.
 * Idempotente: só executa se intent.status === 'settled'.
 * @param client - Quando informado, a transferência roda na mesma transação.
 */
export async function releaseSettledPaymentIntent(
  tenantId: string,
  intent: PaymentIntent,
  client?: PoolClient
): Promise<void> {
  if (intent.status !== 'settled') {
    return;
  }
  await bankAccountService.ensurePlatformAccounts(tenantId, intent.currency as 'BRL');
  const sellerPendingAccount = await bankAccountService.getPlatformLifecycleAccount(
    tenantId,
    'seller_pending',
    intent.currency as 'BRL'
  );
  const sellerAvailableAccount = await bankAccountService.getPlatformLifecycleAccount(
    tenantId,
    'seller_available',
    intent.currency as 'BRL'
  );
  if (!sellerPendingAccount || !sellerAvailableAccount) {
    throw new Error('seller_pending or seller_available account not found for release');
  }
  const authorship = buildSystemAuthorship({ actingForAccountId: sellerPendingAccount.accountId });
  await bankTransactionService.transfer(tenantId, {
    eventId: uuidv4(),
    fromAccountId: sellerPendingAccount.accountId,
    toAccountId: sellerAvailableAccount.accountId,
    amountCents: intent.amountCents,
    currency: intent.currency as BankCurrency,
    transactionType: 'transfer',
    description: `Seller release: ${intent.referenceId}`,
    metadata: undefined,
    referenceType: 'seller_release',
    referenceId: intent.referenceId,
    treasurySource: 'treasury:settlement',
    authorship,
  }, client);
  await updatePaymentIntentMetadata(tenantId, intent.id, {
    seller_release_reference: intent.referenceId,
  });
  await updatePaymentIntentStatus(tenantId, intent.id, 'completed');
  console.log('PAYMENT_INTENT_COMPLETED');
}

/**
 * Resolve evento de pagamento: PIX_PAYMENT_CONFIRMED → (se PaymentIntent existir) transfer(escrow → actor wallet).
 */
export async function resolvePaymentEvent(event: PaymentEvent): Promise<void> {
  console.log('RESOLVING_PAYMENT_EVENT', event);

  if (event.type === 'PIX_PAYMENT_CONFIRMED') {
    const tenantId = event.tenant_id;
    const intent = await getPaymentIntentByReference(tenantId, event.reference_id);
    if (!intent) {
      console.warn('PAYMENT_INTENT_NOT_FOUND');
      return;
    }
    if (intent.status !== 'created') {
      console.warn('PAYMENT_INTENT_ALREADY_PROCESSED');
      return;
    }
    if (!event.actor_id) {
      throw new Error('PIX_PAYMENT_CONFIRMED requires actor_id');
    }
    await bankAccountService.ensurePlatformAccounts(tenantId, 'BRL');
    await bankAccountService.ensureLifecycleAccountsForOwner(tenantId, event.actor_id, 'user', 'BRL');

    const escrowAccount = await bankAccountService.getPlatformLifecycleAccount(
      tenantId,
      'escrow_payments',
      'BRL'
    );
    const walletAccount = await bankAccountService.getLifecycleAccount(
      tenantId,
      event.actor_id,
      'user',
      'user_wallet',
      'BRL'
    );

    if (!escrowAccount || !walletAccount) {
      throw new Error('Escrow or actor wallet account not found');
    }

    const refType =
      typeof event.reference_type === 'string' ? event.reference_type.trim() : '';
    const refId = String(event.reference_id ?? '').trim();
    if (!refType || !refId) {
      throw new Error('BANK_REFERENCE_REQUIRED');
    }

    // C54: Gate financeiro obrigatório antes de transfer (AUTHORITY_PRECEDENCE §4.1)
    const { requireFinancialRiskClearance } = await import('@modules/risk-identity/risk-financial-gate');
    await requireFinancialRiskClearance(tenantId, {
      actorId: event.actor_id,
      action: 'financial_transfer',
      amountCents: event.amount_cents,
    });

    const authorship = buildSystemAuthorship({ actingForAccountId: escrowAccount.accountId });
    const pixTransfer = await bankTransactionService.transfer(tenantId, {
      eventId: uuidv4(),
      fromAccountId: escrowAccount.accountId,
      toAccountId: walletAccount.accountId,
      treasurySource: 'treasury:settlement',
      amountCents: event.amount_cents,
      currency: 'BRL',
      transactionType: 'transfer',
      description: `PIX payment: ${event.reference_id}`,
      metadata: event.metadata ?? undefined,
      referenceType: refType,
      referenceId: refId,
      concept_id: 'pix-payment-received',
      authorship,
    });
    enqueueReconciliation({
      tenant_id: tenantId,
      reference_type: 'bank_transaction',
      reference_id: pixTransfer.transactionId,
    });
    await updatePaymentIntentStatus(tenantId, intent.id, 'payment_received');
    await updatePaymentIntentMetadata(tenantId, intent.id, {
      escrow_transaction_reference: event.reference_id,
      gateway_event_type: event.type,
    });
    await updatePaymentIntentStatus(tenantId, intent.id, 'escrowed');
    console.log('PAYMENT_INTENT_ESCROWED');
    return;
  }

  // Outros tipos de evento: não suportados nesta versão
}