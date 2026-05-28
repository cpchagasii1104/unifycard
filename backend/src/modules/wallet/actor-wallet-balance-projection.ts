// backend/src/modules/wallet/actor-wallet-balance-projection.ts
//
// Helper compartilhado: projeção de available balance de actor_wallet.
// Usado por actor-wallet-statement.service e actor-wallet-payout.service.
//
// AXIOMA PERMANENTE (DECISION-0053 §7):
//   availableBalanceCents é projeção de LEITURA — NÃO é SSOT financeiro.
//   NÃO usar para executar movimentações. F3 recalcula com SELECT FOR UPDATE.

import { pool } from '@core/database/pool';
import { bankAccountService } from '@modules/bank/bank-account.service';

export interface ActorWalletBalanceProjection {
  /** Saldo bruto via bank_ledger. SSOT. */
  grossBalanceCents: number;
  /** SUM(amount_cents - recovered_amount_cents) WHERE status IN ('approved','partially_recovered'). Projeção. */
  pendingRecoveryCents: number;
  /** max(0, gross - pending). Projeção — NÃO autoriza movimentação. */
  availableBalanceCents: number;
}

export async function calculateActorWalletBalanceProjection(
  tenantId: string,
  actorId: string,
  accountId: string
): Promise<ActorWalletBalanceProjection> {
  const [balanceResult, obligResult] = await Promise.all([
    bankAccountService.getBalance(tenantId, accountId),
    pool.query<{ pending_cents: string }>(
      `SELECT COALESCE(SUM(amount_cents - recovered_amount_cents), 0)::text AS pending_cents
         FROM actor_wallet_recovery_obligations
        WHERE tenant_id = $1
          AND debtor_actor_id = $2
          AND status IN ('approved', 'partially_recovered')`,
      [tenantId, actorId]
    ),
  ]);
  const grossBalanceCents = balanceResult.balanceCents;
  const pendingRecoveryCents = parseInt(obligResult.rows[0]!.pending_cents, 10);
  const availableBalanceCents = Math.max(0, grossBalanceCents - pendingRecoveryCents);
  return { grossBalanceCents, pendingRecoveryCents, availableBalanceCents };
}
