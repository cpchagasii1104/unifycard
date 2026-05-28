// backend/src/modules/financial-recovery/recovery-creditor-resolver.service.ts
//
// READ-ONLY resolver — C4 (DECISION-0056, 2026-05-27).
//
// Dado um paymentIntentId, resolve:
//   creditorActorId   = payment_intents.actor_id (o payer original)
//   creditorAccountId = user_wallet do actor (via bankAccountService — bank SSOT)
//
// Destino canônico: user_wallet. actor_wallet vetada por DECISION-0056 D3
// (actor_wallet recebe exclusivamente revenue_share).
//
// Fail-closed — sem fallback silencioso:
//   PAYMENT_INTENT_NOT_FOUND   — intent não existe para o tenant
//   CREDITOR_ACCOUNT_NOT_FOUND — payer não tem user_id ou user_wallet não provisionada
//
// NÃO move dinheiro. NÃO chama bankTransactionService. NÃO mexe em reversal.

import { runQueryWithTenant } from '@core/database/pool';
import type { ResolvedRecoveryCreditor } from '@core/financial-recovery/financial-recovery.types';
import { bankAccountService } from '../bank/bank-account.service';

export class RecoveryCreditorResolverError extends Error {
  constructor(
    public readonly code:
      | 'PAYMENT_INTENT_NOT_FOUND'
      | 'CREDITOR_ACCOUNT_NOT_FOUND',
    message: string
  ) {
    super(message);
    this.name = 'RecoveryCreditorResolverError';
  }
}

export async function resolveRecoveryCreditor(
  tenantId: string,
  paymentIntentId: string
): Promise<ResolvedRecoveryCreditor> {
  const pi = await runQueryWithTenant<{ actor_id: string }>(
    tenantId,
    `SELECT actor_id FROM payment_intents WHERE tenant_id = $1 AND id = $2`,
    [tenantId, paymentIntentId]
  );

  if (!pi) {
    throw new RecoveryCreditorResolverError(
      'PAYMENT_INTENT_NOT_FOUND',
      `payment_intent ${paymentIntentId} not found (tenant ${tenantId})`
    );
  }

  const creditorActorId = pi.actor_id;

  const actorRow = await runQueryWithTenant<{ user_id: string | null }>(
    tenantId,
    `SELECT user_id FROM actors WHERE tenant_id = $1 AND id = $2`,
    [tenantId, creditorActorId]
  );

  const userId = actorRow?.user_id;
  if (!userId) {
    throw new RecoveryCreditorResolverError(
      'CREDITOR_ACCOUNT_NOT_FOUND',
      `payer actor ${creditorActorId} has no user_id — cannot resolve user_wallet (tenant ${tenantId})`
    );
  }

  const creditorWallet = await bankAccountService.getLifecycleAccount(tenantId, userId, 'user', 'user_wallet');

  if (!creditorWallet) {
    throw new RecoveryCreditorResolverError(
      'CREDITOR_ACCOUNT_NOT_FOUND',
      `payer actor ${creditorActorId} has no user_wallet (tenant ${tenantId}) — see DT-USER-WALLET-PROVISIONING-FOR-RECOVERY`
    );
  }

  return {
    paymentIntentId,
    creditorActorId,
    creditorAccountId: creditorWallet.accountId,
  };
}
