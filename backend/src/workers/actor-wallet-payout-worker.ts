// backend/src/workers/actor-wallet-payout-worker.ts
// F-PAYOUT-WORKER-SYSTEM-ONLY-SEAL (DECISION-0128).
//
// Worker CANÔNICO system-only do payout de produção. NÃO cria executor novo: liga o executor JÁ SELADO
// (executeActorWalletPayout, F-PAYOUT-EXECUTION-SEAL) ao único trilho válido:
//   actor_wallet_payout_requests.status='approved' (approval aprovado via Core) → executeActorWalletPayout
//   → recovery lock + recompute → BankTransactionPort (bank_ledger/bank_transactions) → status final.
//
// INVARIANTES:
//   - DEFAULT-OFF: só inicia com ENABLE_PAYOUT_WORKER==='true' (estrito; sem auto-enable por NODE_ENV).
//   - System-only: sem HTTP, sem actorId/body/query/tenant client-declared. subject (performedByUserId) vem
//     server-side do approval_request.requested_by_user_id (dono da wallet; authorship='ownership' no executor).
//   - NÃO usa seller_available / seller_payout / payout_requests legado / bank_settlements como executor.
//   - NÃO chama bankTransactionService.transfer diretamente — só o executor selado toca o Bank.
//   - Idempotência/concorrência: o executor serializa via FOR UPDATE + uq_bank_transactions_reference;
//     o claim usa FOR UPDATE SKIP LOCKED para batches disjuntos entre ciclos concorrentes.

import { pool } from '@core/database/pool';
import { actorWalletPayoutService } from '@modules/wallet/actor-wallet-payout.service';
import { isFinancialWorkerEnabled } from './financial-worker-gate';

const INTERVAL_MS = 10_000;
const BATCH_LIMIT = 20;
let intervalId: ReturnType<typeof setInterval> | null = null;

export interface ClaimedActorWalletPayout {
  id: string;
  tenantId: string;
  /** subject server-side = dono que solicitou (approval_request.requested_by_user_id). */
  performedByUserId: string;
}

// Claim: SOMENTE actor_wallet_payout_requests 'approved' com approval vinculado. FOR UPDATE OF awp SKIP LOCKED
// garante batches disjuntos entre ciclos concorrentes (o lock é liberado no COMMIT; o executor re-trava).
export async function claimApprovedActorWalletPayouts(limit = BATCH_LIMIT): Promise<ClaimedActorWalletPayout[]> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query<{ id: string; tenant_id: string; requested_by_user_id: string }>(
      `SELECT awp.id, awp.tenant_id, ar.requested_by_user_id
         FROM actor_wallet_payout_requests awp
         JOIN approval_requests ar ON ar.id = awp.approval_request_id
        WHERE awp.status = 'approved' AND awp.approval_request_id IS NOT NULL
        ORDER BY awp.created_at ASC
        FOR UPDATE OF awp SKIP LOCKED
        LIMIT $1`,
      [limit]
    );
    await client.query('COMMIT');
    return r.rows.map((x) => ({ id: x.id, tenantId: x.tenant_id, performedByUserId: x.requested_by_user_id }));
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export interface ActorWalletPayoutCycleResult {
  processed: number;
  completed: number;
  idempotent: number;
  failed: number;
}

// Ciclo testável (sem interval): processa um batch de approved via executor selado.
export async function runActorWalletPayoutWorkerCycle(limit = BATCH_LIMIT): Promise<ActorWalletPayoutCycleResult> {
  const claimed = await claimApprovedActorWalletPayouts(limit);
  let completed = 0;
  let idempotent = 0;
  let failed = 0;
  for (const c of claimed) {
    try {
      const res = await actorWalletPayoutService.executeActorWalletPayout(c.tenantId, c.id, c.performedByUserId);
      if (res.result === 'completed') completed++;
      else if (res.result === 'completed_idempotent') idempotent++;
      else failed++; // failed_zero_after_drain (decisão limpa do executor; não é erro técnico)
    } catch (err) {
      // Erro transitório: o executor faz ROLLBACK (status volta a 'approved'/permanece) — será reprocessado
      // no próximo ciclo. NUNCA marcar 'completed' aqui; NUNCA tocar o Bank fora do executor.
      failed++;
      console.error('[ActorWalletPayoutWorker] execução falhou (será reprocessado):', c.id, err instanceof Error ? err.message : err);
    }
  }
  return { processed: claimed.length, completed, idempotent, failed };
}

export function startActorWalletPayoutWorker(): boolean {
  // DEFAULT-OFF estrito (também gateado no BOOT; defesa em profundidade).
  if (!isFinancialWorkerEnabled('ENABLE_PAYOUT_WORKER')) {
    console.log('[ActorWalletPayoutWorker] DESLIGADO (default-off; ENABLE_PAYOUT_WORKER≠true).');
    return false;
  }
  if (intervalId !== null) return true;
  runActorWalletPayoutWorkerCycle().catch((err) => console.error('[ActorWalletPayoutWorker] ciclo inicial:', err));
  intervalId = setInterval(() => {
    runActorWalletPayoutWorkerCycle().catch((err) => console.error('[ActorWalletPayoutWorker] ciclo:', err));
  }, INTERVAL_MS);
  console.log('[ActorWalletPayoutWorker] iniciado (system-only; consome actor_wallet_payout_requests approved a cada 10s).');
  return true;
}
