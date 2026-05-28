// backend/src/modules/wallet/actor-wallet-payout.service.ts
//
// F2 — requestActorWalletPayout (DECISION-0058, 2026-05-28).
//
// Cria pedido de saque de actor_wallet em status 'pending_approval'.
// Zero movimentação financeira. Zero worker. Zero rota pública.
//
// ESCOPO F2 (este arquivo):
//   — Validar entrada
//   — Verificar idempotência
//   — Calcular snapshot informativo (gross − pending = available)
//   — Bloquear se requestedAmount > available no momento do pedido
//   — Criar approval_request + actor_wallet_payout_requests em BEGIN/COMMIT
//
// FORA DO ESCOPO (F3 — não implementado):
//   — Execução financeira real
//   — SELECT FOR UPDATE em obrigações
//   — debitActorWalletForRecovery
//   — bankTransactionService.transfer
//   — bank_ledger escrita
//
// AXIOMA PERMANENTE:
//   availableBalanceCents NÃO é SSOT financeiro.
//   Ele permite criar o pedido; NÃO autoriza débito.
//   F3 DEVE recalcular tudo dentro da transação com SELECT FOR UPDATE.

import { v4 as uuidv4 } from 'uuid';
import { pool, getClientWithTenant } from '@core/database/pool';
import { bankAccountService } from '@modules/bank/bank-account.service';
import {
  ACTOR_WALLET_PAYOUT_OPERATION_TYPE,
  type ActorWalletPayoutRequest,
  type ActorWalletPayoutRequestRow,
  toActorWalletPayoutRequest,
} from './actor-wallet-payout-request.types';

// ── Error class ───────────────────────────────────────────────────────────────

export class ActorWalletPayoutError extends Error {
  constructor(
    public readonly code:
      | 'ACTOR_WALLET_PAYOUT_AMOUNT_ZERO'
      | 'ACTOR_WALLET_PAYOUT_MISSING_IDEMPOTENCY_KEY'
      | 'ACTOR_WALLET_PAYOUT_MISSING_REASON'
      | 'ACTOR_WALLET_PAYOUT_MISSING_REQUESTED_BY'
      | 'ACTOR_WALLET_NOT_FOUND'
      | 'ACTOR_WALLET_PAYOUT_INSUFFICIENT_AVAILABLE_BALANCE',
    message: string
  ) {
    super(message);
    this.name = 'ActorWalletPayoutError';
  }
}

// ── Input/Output ──────────────────────────────────────────────────────────────

export interface RequestActorWalletPayoutInput {
  tenantId: string;
  actorId: string;
  /** Usuário que faz a solicitação (para approval_request.requested_by_user_id). */
  requestedByUserId: string;
  requestedAmountCents: number;
  idempotencyKey: string;
  /** Justificativa/motivo do saque — armazenada em approval_request.operation_data. */
  reason: string;
}

export interface RequestActorWalletPayoutResult {
  payoutRequest: ActorWalletPayoutRequest;
  /** true se o pedido já existia (idempotência); false se foi criado agora. */
  alreadyExisted: boolean;
  /** Snapshot informativo calculado no momento do pedido (NÃO é SSOT). */
  balanceSnapshot: {
    grossBalanceCents: number;
    pendingRecoveryCents: number;
    availableBalanceCents: number;
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

class ActorWalletPayoutService {
  /**
   * Cria uma solicitação de saque de actor_wallet em status 'pending_approval'.
   *
   * Zero movimentação financeira. Approval gate é obrigatório antes de execução (F3).
   * Segunda chamada com a mesma idempotency_key retorna o pedido existente.
   */
  async requestActorWalletPayout(
    input: RequestActorWalletPayoutInput
  ): Promise<RequestActorWalletPayoutResult> {
    const { tenantId, actorId, requestedByUserId, requestedAmountCents, idempotencyKey, reason } =
      input;

    // ── 1. Validações de entrada ──────────────────────────────────────────────

    if (requestedAmountCents <= 0) {
      throw new ActorWalletPayoutError(
        'ACTOR_WALLET_PAYOUT_AMOUNT_ZERO',
        'requestedAmountCents deve ser maior que zero'
      );
    }
    if (!idempotencyKey || idempotencyKey.trim().length === 0) {
      throw new ActorWalletPayoutError(
        'ACTOR_WALLET_PAYOUT_MISSING_IDEMPOTENCY_KEY',
        'idempotencyKey é obrigatória para payout de actor_wallet'
      );
    }
    if (!reason || reason.trim().length === 0) {
      throw new ActorWalletPayoutError(
        'ACTOR_WALLET_PAYOUT_MISSING_REASON',
        'reason é obrigatória para payout de actor_wallet'
      );
    }
    if (!requestedByUserId) {
      throw new ActorWalletPayoutError(
        'ACTOR_WALLET_PAYOUT_MISSING_REQUESTED_BY',
        'requestedByUserId é obrigatório para registrar autoria da solicitação'
      );
    }

    // ── 2. Idempotência — verificar antes de qualquer escrita ─────────────────

    const existing = await pool.query<ActorWalletPayoutRequestRow>(
      `SELECT * FROM actor_wallet_payout_requests
        WHERE tenant_id = $1 AND idempotency_key = $2
        LIMIT 1`,
      [tenantId, idempotencyKey]
    );
    if (existing.rows[0]) {
      const existingRequest = toActorWalletPayoutRequest(existing.rows[0]);
      // Recalcular snapshot para retorno informativo (saldo pode ter mudado)
      const wallet = await bankAccountService.getActorWalletAccount(tenantId, actorId);
      const snapshot = wallet
        ? await this._calculateSnapshot(tenantId, actorId, wallet.accountId)
        : { grossBalanceCents: 0, pendingRecoveryCents: 0, availableBalanceCents: 0 };
      return { payoutRequest: existingRequest, alreadyExisted: true, balanceSnapshot: snapshot };
    }

    // ── 3. Verificar actor_wallet ─────────────────────────────────────────────

    const wallet = await bankAccountService.getActorWalletAccount(tenantId, actorId);
    if (!wallet) {
      throw new ActorWalletPayoutError(
        'ACTOR_WALLET_NOT_FOUND',
        `actor_wallet não encontrada para actor ${actorId} no tenant ${tenantId}`
      );
    }

    // ── 4. Snapshot informativo de saldo ──────────────────────────────────────
    // Calculado ANTES da TX; não é SSOT — F3 recalcula com SELECT FOR UPDATE.

    const snapshot = await this._calculateSnapshot(tenantId, actorId, wallet.accountId);

    // ── 5. Gate de criação: amount <= available no snapshot ───────────────────
    // Filtro conservador de criação de pedido. NÃO substitui a validação em F3.

    if (requestedAmountCents > snapshot.availableBalanceCents) {
      throw new ActorWalletPayoutError(
        'ACTOR_WALLET_PAYOUT_INSUFFICIENT_AVAILABLE_BALANCE',
        `Saldo disponível projetado (${snapshot.availableBalanceCents} cents) insuficiente ` +
          `para payout de ${requestedAmountCents} cents. ` +
          `gross=${snapshot.grossBalanceCents} pending=${snapshot.pendingRecoveryCents}. ` +
          `availableBalanceCents é projeção — NÃO é SSOT financeiro.`
      );
    }

    // ── 6. Criar approval_request + payout_request em BEGIN/COMMIT ────────────

    const client = await getClientWithTenant(tenantId);
    try {
      await client.query('BEGIN');

      // 6a. approval_request (gate obrigatório — DECISION-0054 + DECISION-0058 D4)
      const approvalId = uuidv4();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias
      await client.query(
        `INSERT INTO approval_requests
           (id, tenant_id,
            requested_by_user_id, acting_for_actor_id, acting_for_account_id,
            operation_type, operation_data,
            required_approvals, approval_type,
            status, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 1, 'sequential', 'pending', $8)`,
        [
          approvalId,
          tenantId,
          requestedByUserId,
          actorId,
          wallet.accountId,
          ACTOR_WALLET_PAYOUT_OPERATION_TYPE,
          JSON.stringify({
            requested_amount_cents: requestedAmountCents,
            destination_type: 'internal_settlement',
            reason,
            snapshot_gross_balance_cents: snapshot.grossBalanceCents,
            snapshot_pending_recovery_cents: snapshot.pendingRecoveryCents,
            snapshot_available_balance_cents: snapshot.availableBalanceCents,
          }),
          expiresAt,
        ]
      );

      // 6b. actor_wallet_payout_requests
      const payoutId = uuidv4();
      const payoutRow = await client.query<ActorWalletPayoutRequestRow>(
        `INSERT INTO actor_wallet_payout_requests
           (id, tenant_id,
            actor_id, actor_wallet_account_id,
            approval_request_id,
            requested_amount_cents,
            destination_type,
            idempotency_key,
            status)
         VALUES ($1, $2, $3, $4, $5, $6, 'internal_settlement', $7, 'pending_approval')
         RETURNING *`,
        [
          payoutId,
          tenantId,
          actorId,
          wallet.accountId,
          approvalId,
          requestedAmountCents,
          idempotencyKey,
        ]
      );

      await client.query('COMMIT');

      return {
        payoutRequest: toActorWalletPayoutRequest(payoutRow.rows[0]!),
        alreadyExisted: false,
        balanceSnapshot: snapshot,
      };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  // ── helpers ──────────────────────────────────────────────────────────────────

  private async _calculateSnapshot(
    tenantId: string,
    actorId: string,
    accountId: string
  ): Promise<{ grossBalanceCents: number; pendingRecoveryCents: number; availableBalanceCents: number }> {
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
}

export const actorWalletPayoutService = new ActorWalletPayoutService();
