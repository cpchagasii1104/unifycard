// backend/src/modules/financial-recovery/recovery-creditor-resolver.service.ts
//
// READ-ONLY resolver — C4 (DECISION-0056, 2026-05-27).
//
// Dado um paymentIntentId, resolve:
//   creditorActorId  = payment_intents.actor_id (o payer original)
//   creditorAccountId = bank_accounts.id onde account_type='user_wallet' AND actor_id=payer
//
// Destino canônico: user_wallet. actor_wallet vetada por DECISION-0056 D3
// (actor_wallet recebe exclusivamente revenue_share).
//
// Fail-closed — sem fallback silencioso:
//   PAYMENT_INTENT_NOT_FOUND   — intent não existe para o tenant
//   CREDITOR_ACCOUNT_NOT_FOUND — payer não tem user_wallet (dormente; ver DT-USER-WALLET-PROVISIONING-FOR-RECOVERY)
//   CREDITOR_ACCOUNT_AMBIGUOUS — payer tem mais de uma user_wallet (sem LIMIT 1)
//
// NÃO move dinheiro. NÃO chama bankTransactionService. NÃO mexe em reversal.

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { ResolvedRecoveryCreditor } from '@core/financial-recovery/financial-recovery.types';

export class RecoveryCreditorResolverError extends Error {
  constructor(
    public readonly code:
      | 'PAYMENT_INTENT_NOT_FOUND'
      | 'CREDITOR_ACCOUNT_NOT_FOUND'
      | 'CREDITOR_ACCOUNT_AMBIGUOUS',
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

  const wallets = await runQueriesWithTenant<{ id: string }>(
    tenantId,
    `SELECT id FROM bank_accounts
     WHERE tenant_id = $1 AND actor_id = $2 AND account_type = 'user_wallet'`,
    [tenantId, creditorActorId]
  );

  if (wallets.length === 0) {
    throw new RecoveryCreditorResolverError(
      'CREDITOR_ACCOUNT_NOT_FOUND',
      `payer actor ${creditorActorId} has no user_wallet (tenant ${tenantId}) — see DT-USER-WALLET-PROVISIONING-FOR-RECOVERY`
    );
  }

  if (wallets.length > 1) {
    throw new RecoveryCreditorResolverError(
      'CREDITOR_ACCOUNT_AMBIGUOUS',
      `payer actor ${creditorActorId} has ${wallets.length} user_wallet accounts (tenant ${tenantId})`
    );
  }

  return {
    paymentIntentId,
    creditorActorId,
    creditorAccountId: wallets[0]!.id,
  };
}
