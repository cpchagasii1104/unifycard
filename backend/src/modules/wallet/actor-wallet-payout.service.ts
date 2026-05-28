// backend/src/modules/wallet/actor-wallet-payout.service.ts
//
// F2 — requestActorWalletPayout (DECISION-0058, 2026-05-28).
// F3 — executeActorWalletPayout (DECISION-0058 D2 + D-3/D-4, 2026-05-28).
//
// F2: cria pedido de saque em status 'pending_approval'. Zero financeiro.
// F3: executa o saque (drain → transfer → completed). MOVE DINHEIRO via
//     bankTransactionService.transfer com authorship='ownership'.
//
// AXIOMAS PERMANENTES:
//   - availableBalanceCents (F2) NÃO é SSOT financeiro.
//   - F3 SEMPRE recalcula saldo dentro da TX com mesmo client (pós-drain).
//   - Lock order: payout_request FOR UPDATE → obligations FOR UPDATE (via drain)
//                 → bank_accounts FOR UPDATE (via transfer).
//   - Authorship 'ownership' (NÃO 'system'): saque é voluntário do actor.

import { v4 as uuidv4 } from 'uuid';
import { pool, getClientWithTenant } from '@core/database/pool';
import { bankAccountService } from '@modules/bank/bank-account.service';
import { bankTransactionService } from '@modules/bank/bank-transaction.service';
import { bankLedgerRepository } from '@modules/bank/bank-ledger.repository';
import { buildFinancialAuthorshipFromRequest } from '@modules/bank/financial-authorship.helper';
import { drainRecoveryObligationsForCredit } from '@modules/financial-recovery/actor-wallet-recovery-obligation.service';
import {
  ACTOR_WALLET_PAYOUT_OPERATION_TYPE,
  ACTOR_WALLET_PAYOUT_REFERENCE_TYPE,
  type ActorWalletPayoutRequest,
  type ActorWalletPayoutRequestRow,
  toActorWalletPayoutRequest,
} from './actor-wallet-payout-request.types';
import { calculateActorWalletBalanceProjection } from './actor-wallet-balance-projection';

// ── Error class ───────────────────────────────────────────────────────────────

export class ActorWalletPayoutError extends Error {
  constructor(
    public readonly code:
      // F2 (request) errors
      | 'ACTOR_WALLET_PAYOUT_AMOUNT_ZERO'
      | 'ACTOR_WALLET_PAYOUT_MISSING_IDEMPOTENCY_KEY'
      | 'ACTOR_WALLET_PAYOUT_MISSING_REASON'
      | 'ACTOR_WALLET_PAYOUT_MISSING_REQUESTED_BY'
      | 'ACTOR_WALLET_NOT_FOUND'
      | 'ACTOR_WALLET_PAYOUT_INSUFFICIENT_AVAILABLE_BALANCE'
      | 'ACTOR_WALLET_PAYOUT_ALREADY_ACTIVE'
      // F3 (execution) errors
      | 'PAYOUT_REQUEST_NOT_FOUND'
      | 'PAYOUT_NOT_APPROVED'
      | 'PAYOUT_ALREADY_PROCESSING'
      | 'PAYOUT_TERMINAL_BLOCKED'
      | 'PAYOUT_APPROVAL_NOT_FOUND'
      | 'PAYOUT_APPROVAL_WRONG_TYPE'
      | 'PAYOUT_APPROVAL_EXPIRED'
      | 'PAYOUT_SETTLEMENT_ACCOUNT_MISSING'
      | 'PAYOUT_MISSING_PERFORMED_BY',
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

// ── F3 Output ─────────────────────────────────────────────────────────────────

export type ExecuteActorWalletPayoutResultKind =
  /** Sucesso: payout transfer executado, request='completed' */
  | 'completed'
  /** Idempotente: request já estava 'completed', sem novo transfer */
  | 'completed_idempotent'
  /** D-4: saldo zero após drain, request='failed' com zero_available_after_recovery_drain */
  | 'failed_zero_after_drain';

export interface ExecuteActorWalletPayoutResult {
  result: ExecuteActorWalletPayoutResultKind;
  payoutRequestId: string;
  /** Valor efetivamente sacado em centavos. Pode ser < requested se houve drain (D-3). */
  executedAmountCents: number;
  /** bank_transactions.id do débito de saque. NULL quando D-4 (zero após drain). */
  settlementTransactionId: string | null;
  /** Resumo do drain síncrono executado antes do payout. */
  drainResult: {
    totalDrainedCents: number;
    residualCreditCents: number;
    obligationsTouched: number;
    entriesCreated: number;
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
        ? await calculateActorWalletBalanceProjection(tenantId, actorId, wallet.accountId)
        : { grossBalanceCents: 0, pendingRecoveryCents: 0, availableBalanceCents: 0 };
      return { payoutRequest: existingRequest, alreadyExisted: true, balanceSnapshot: snapshot };
    }

    // ── 2b. Active-gate — um actor só pode ter 1 request ativo por vez ────────
    // Idempotência vem antes: mesma key não ativa este gate.
    // Previne exposição semântica a aprovação duplicada (DECISION-0058 hardening).

    const activeRequest = await pool.query<{ id: string }>(
      `SELECT id FROM actor_wallet_payout_requests
        WHERE tenant_id = $1 AND actor_id = $2
          AND status IN ('pending_approval', 'approved', 'processing')
        LIMIT 1`,
      [tenantId, actorId]
    );
    if (activeRequest.rows[0]) {
      throw new ActorWalletPayoutError(
        'ACTOR_WALLET_PAYOUT_ALREADY_ACTIVE',
        `actor ${actorId} já possui request ativo (id=${activeRequest.rows[0].id}). ` +
          `Cancele ou aguarde a resolução do pedido anterior antes de criar um novo.`
      );
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

    const snapshot = await calculateActorWalletBalanceProjection(tenantId, actorId, wallet.accountId);

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
    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => {});
      // Race condition: dois requests paralelos passaram pelo active-gate
      // antes que um deles comitasse — partial index captura aqui.
      if (
        err.code === '23505' &&
        err.constraint === 'uidx_actor_wallet_payout_one_active_per_actor'
      ) {
        throw new ActorWalletPayoutError(
          'ACTOR_WALLET_PAYOUT_ALREADY_ACTIVE',
          `actor ${actorId} já possui request ativo (conflito de concorrência detectado pelo index).`
        );
      }
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Executa o saque (F3 — DECISION-0058 D2 + D-3/D-4).
   *
   * Fluxo atômico (BEGIN/COMMIT único):
   *   1. SELECT FOR UPDATE no payout_request
   *   2. Validar status e approval_request
   *   3. UPDATE status → 'processing'
   *   4. Drain de obligations via drainRecoveryObligationsForCredit
   *      (lock FOR UPDATE em obligations FIFO; mesmo client)
   *   5. Recalcular saldo pós-drain com mesmo client
   *   6. payoutAmount = min(approved|requested, availableAfterDrain)
   *   7a. Se payoutAmount = 0 → status='failed', failed_reason='zero_available_after_recovery_drain'
   *   7b. Se payoutAmount > 0 → transfer actor_wallet → bank_settlement,
   *                              authorship='ownership', UPDATE status='completed'
   *
   * Idempotência:
   *   - Status 'completed' → retorna resultado existente sem novo transfer
   *   - bankTransactionService.transfer tem lock por (reference_type, reference_id)
   *     que garante UMA execução por payout_request_id
   *
   * Authorship:
   *   - performedByUserId = quem executou (obrigatório)
   *   - actingForActorId = actor da wallet
   *   - actingForAccountId = actor_wallet_account_id
   *   - authoritySource = 'ownership'
   *   - permissionSnapshot.reason = "Approval {id} approved"
   */
  async executeActorWalletPayout(
    tenantId: string,
    payoutRequestId: string,
    performedByUserId: string
  ): Promise<ExecuteActorWalletPayoutResult> {
    if (!tenantId || !payoutRequestId) {
      throw new ActorWalletPayoutError(
        'PAYOUT_REQUEST_NOT_FOUND',
        'tenantId e payoutRequestId são obrigatórios'
      );
    }
    if (!performedByUserId) {
      throw new ActorWalletPayoutError(
        'PAYOUT_MISSING_PERFORMED_BY',
        'performedByUserId é obrigatório para autoria do payout (ownership)'
      );
    }

    const client = await getClientWithTenant(tenantId);
    try {
      await client.query('BEGIN');

      // ── 1. SELECT FOR UPDATE no payout_request ──────────────────────────────
      const reqResult = await client.query<ActorWalletPayoutRequestRow>(
        `SELECT * FROM actor_wallet_payout_requests
          WHERE tenant_id = $1 AND id = $2
          FOR UPDATE`,
        [tenantId, payoutRequestId]
      );
      const req = reqResult.rows[0];
      if (!req) {
        throw new ActorWalletPayoutError(
          'PAYOUT_REQUEST_NOT_FOUND',
          `payout_request ${payoutRequestId} não encontrado para tenant ${tenantId}`
        );
      }

      // ── 2. Validar status ────────────────────────────────────────────────────
      if (req.status === 'pending_approval') {
        throw new ActorWalletPayoutError(
          'PAYOUT_NOT_APPROVED',
          `payout_request ${payoutRequestId} está em pending_approval — gate de aprovação não passou`
        );
      }
      if (req.status === 'processing') {
        throw new ActorWalletPayoutError(
          'PAYOUT_ALREADY_PROCESSING',
          `payout_request ${payoutRequestId} já está em processing — execução concorrente bloqueada`
        );
      }
      if (req.status === 'completed') {
        // Idempotente: retorna resultado existente, zero novo transfer
        await client.query('COMMIT');
        return {
          result: 'completed_idempotent',
          payoutRequestId,
          executedAmountCents: Number(req.executed_amount_cents ?? 0),
          settlementTransactionId: req.settlement_transaction_id,
          drainResult: { totalDrainedCents: 0, residualCreditCents: 0, obligationsTouched: 0, entriesCreated: 0 },
        };
      }
      if (req.status === 'failed' || req.status === 'cancelled' || req.status === 'rejected') {
        throw new ActorWalletPayoutError(
          'PAYOUT_TERMINAL_BLOCKED',
          `payout_request ${payoutRequestId} está em status terminal '${req.status}' — execução bloqueada`
        );
      }
      // req.status === 'approved' a partir daqui

      // ── 3. Validar approval_request ──────────────────────────────────────────
      if (!req.approval_request_id) {
        throw new ActorWalletPayoutError(
          'PAYOUT_APPROVAL_NOT_FOUND',
          `payout_request ${payoutRequestId} sem approval_request_id vinculado`
        );
      }
      const approvalResult = await client.query<{
        status: string;
        operation_type: string;
        expires_at: Date | null;
      }>(
        `SELECT status, operation_type, expires_at FROM approval_requests
          WHERE tenant_id = $1 AND id = $2`,
        [tenantId, req.approval_request_id]
      );
      const approval = approvalResult.rows[0];
      if (!approval) {
        throw new ActorWalletPayoutError(
          'PAYOUT_APPROVAL_NOT_FOUND',
          `approval_request ${req.approval_request_id} não encontrado`
        );
      }
      if (approval.operation_type !== ACTOR_WALLET_PAYOUT_OPERATION_TYPE) {
        throw new ActorWalletPayoutError(
          'PAYOUT_APPROVAL_WRONG_TYPE',
          `approval_request operation_type='${approval.operation_type}', esperado '${ACTOR_WALLET_PAYOUT_OPERATION_TYPE}'`
        );
      }
      if (approval.status !== 'approved') {
        throw new ActorWalletPayoutError(
          'PAYOUT_NOT_APPROVED',
          `approval_request status='${approval.status}', esperado 'approved'`
        );
      }
      if (approval.expires_at && new Date(approval.expires_at).getTime() < Date.now()) {
        throw new ActorWalletPayoutError(
          'PAYOUT_APPROVAL_EXPIRED',
          `approval_request expirou em ${approval.expires_at.toISOString()}`
        );
      }

      // ── 4. Mark as processing (lock semântico explícito) ─────────────────────
      await client.query(
        `UPDATE actor_wallet_payout_requests SET status='processing', updated_at=NOW() WHERE id=$1`,
        [payoutRequestId]
      );

      // ── 5. Saldo bruto pré-drain (mesmo client) ──────────────────────────────
      const balanceBefore = await bankLedgerRepository.calculateBalance(
        tenantId,
        req.actor_wallet_account_id,
        client
      );

      // ── 6. Drain obligations (FOR UPDATE FIFO; cap = saldo atual) ────────────
      // drainRecoveryObligationsForCredit serializa via FOR UPDATE em obligations.
      // Após drain, balance pode ter diminuído (transfer wallet→creditor por obligation).
      const drainResult = await drainRecoveryObligationsForCredit(
        tenantId,
        req.actor_id,
        balanceBefore.balanceCents,
        client
      );

      // ── 7. Saldo pós-drain (mesmo client; recalcula com bank_ledger atualizado) ─
      const balanceAfter = await bankLedgerRepository.calculateBalance(
        tenantId,
        req.actor_wallet_account_id,
        client
      );

      // ── 8. Computar valor do payout (D-3: partial OK) ────────────────────────
      const requestedOrApproved = Number(req.approved_amount_cents ?? req.requested_amount_cents);
      const availableAfterDrain = balanceAfter.balanceCents;
      const payoutAmountCents = Math.min(requestedOrApproved, availableAfterDrain);

      // ── 9a. Zero-after-drain (D-4): falha limpa, libera active-gate ──────────
      // executed_amount_cents deixado NULL (CHECK chk_payout_request_executed_positive
      // exige > 0 quando não-null; 0 é proibido).
      if (payoutAmountCents <= 0) {
        await client.query(
          `UPDATE actor_wallet_payout_requests
              SET status = 'failed',
                  failed_reason = $1,
                  updated_at = NOW()
            WHERE id = $2`,
          ['zero_available_after_recovery_drain', payoutRequestId]
        );
        await client.query('COMMIT');
        return {
          result: 'failed_zero_after_drain',
          payoutRequestId,
          executedAmountCents: 0,
          settlementTransactionId: null,
          drainResult,
        };
      }

      // ── 9b. Transfer actor_wallet → bank_settlement ──────────────────────────
      const settlementAccount = await bankAccountService.getPlatformLifecycleAccount(
        tenantId,
        'bank_settlement',
        'BRL'
      );
      if (!settlementAccount) {
        throw new ActorWalletPayoutError(
          'PAYOUT_SETTLEMENT_ACCOUNT_MISSING',
          `Conta lifecycle 'bank_settlement' não encontrada para tenant ${tenantId}`
        );
      }

      // Authorship 'ownership' — actor está sacando o próprio saldo (não system).
      // permissionSnapshot ancora a decisão no approval_request aprovado.
      const authorship = buildFinancialAuthorshipFromRequest({
        performedByUserId,
        actingForActorId: req.actor_id,
        actingForAccountId: req.actor_wallet_account_id,
        authoritySource: 'ownership',
        permissionSnapshot: {
          permissionKey: 'actor_wallet_payout_execute',
          allowed: true,
          reason: `approval_request ${req.approval_request_id} status=approved`,
          actorId: req.actor_id,
          userId: performedByUserId,
          decidedAt: new Date().toISOString(),
        },
      });

      const transferResult = await bankTransactionService.transfer(
        tenantId,
        {
          eventId: uuidv4(),
          fromAccountId: req.actor_wallet_account_id,
          toAccountId: settlementAccount.accountId,
          amountCents: payoutAmountCents,
          currency: 'BRL',
          transactionType: 'withdrawal',
          referenceType: ACTOR_WALLET_PAYOUT_REFERENCE_TYPE,
          referenceId: payoutRequestId,
          concept_id: 'actor-wallet-payout',
          description: `Actor wallet payout ${payoutRequestId}`,
          authorship,
        },
        client
      );

      // ── 10. Update payout_request → completed ────────────────────────────────
      await client.query(
        `UPDATE actor_wallet_payout_requests
            SET status = 'completed',
                executed_amount_cents = $1,
                settlement_transaction_id = $2,
                updated_at = NOW()
          WHERE id = $3`,
        [payoutAmountCents, transferResult.transactionId, payoutRequestId]
      );

      // ── 11. COMMIT ───────────────────────────────────────────────────────────
      await client.query('COMMIT');

      return {
        result: 'completed',
        payoutRequestId,
        executedAmountCents: payoutAmountCents,
        settlementTransactionId: transferResult.transactionId,
        drainResult,
      };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
}

export const actorWalletPayoutService = new ActorWalletPayoutService();
