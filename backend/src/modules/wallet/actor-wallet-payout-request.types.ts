// backend/src/modules/wallet/actor-wallet-payout-request.types.ts
//
// Tipos canônicos para actor_wallet_payout_requests.
// DECISION-0058 D1–D5 (2026-05-28).
//
// F1 SUBSTRATE — apenas tipos. Serviço de criação (F2) e execução
// atômica (F3) são frentes separadas.
//
// ATENÇÃO:
//   - availableBalanceCents (actor-wallet-statement) NÃO autoriza saque.
//   - Execução requer approval_request com status='approved'.
//   - Drain síncrono de obrigações ocorre em F3, não aqui.

/** Status lifecycle de uma solicitação de saque de actor_wallet. */
export type ActorWalletPayoutRequestStatus =
  | 'pending_approval' // criado, aguardando gate de aprovação
  | 'approved'         // aprovado; pronto para execução financeira (F3)
  | 'processing'       // execução em andamento (lock tomado)
  | 'completed'        // saque executado; settlement_transaction_id preenchido
  | 'failed'           // falha durante execução após approved
  | 'cancelled'        // cancelado antes da execução
  | 'rejected';        // reprovado no vote de aprovação

/**
 * Tipo de destino do saque.
 * MVP: apenas 'internal_settlement' (DECISION-0058 D3).
 * PIX/TED são fase 2 — não habilitar sem DECISION explícita.
 */
export type ActorWalletPayoutDestinationType = 'internal_settlement';

/** Row de actor_wallet_payout_requests como retornado do DB. */
export interface ActorWalletPayoutRequestRow {
  id: string;
  tenant_id: string;

  actor_id: string;
  actor_wallet_account_id: string;

  approval_request_id: string | null;

  requested_amount_cents: string;  // BIGINT retorna como string do pg
  approved_amount_cents: string | null;
  executed_amount_cents: string | null;

  destination_type: ActorWalletPayoutDestinationType;
  destination_key: string | null;

  settlement_transaction_id: string | null;
  idempotency_key: string | null;

  status: ActorWalletPayoutRequestStatus;
  failed_reason: string | null;

  created_at: Date;
  updated_at: Date;
}

/** Representação de domínio com amountCents como number. */
export interface ActorWalletPayoutRequest {
  id: string;
  tenantId: string;

  actorId: string;
  actorWalletAccountId: string;

  approvalRequestId: string | null;

  /** Valor solicitado pelo actor. */
  requestedAmountCents: number;
  /** Valor fixado pelo aprovador (pode ser <= requested). Null até aprovação. */
  approvedAmountCents: number | null;
  /**
   * Valor real após drain de obrigações de recovery (DECISION-0058 D2).
   * Pode ser menor que approvedAmountCents. Null até execução (F3).
   * NÃO usar como SSOT — bank_ledger é SSOT.
   */
  executedAmountCents: number | null;

  destinationType: ActorWalletPayoutDestinationType;
  destinationKey: string | null;

  /** Referência à bank_transactions do débito. Preenchida em F3. */
  settlementTransactionId: string | null;
  idempotencyKey: string | null;

  status: ActorWalletPayoutRequestStatus;
  failedReason: string | null;

  createdAt: string;
  updatedAt: string;
}

/** Estados terminais — pedido não pode mais ser modificado. */
export const ACTOR_WALLET_PAYOUT_TERMINAL_STATUSES: ActorWalletPayoutRequestStatus[] =
  ['completed', 'failed', 'cancelled', 'rejected'];

/** Estados que permitem execução financeira (F3). */
export const ACTOR_WALLET_PAYOUT_EXECUTABLE_STATUSES: ActorWalletPayoutRequestStatus[] =
  ['approved'];

/** operation_type canônico para approval_requests (DECISION-0058 D5). */
export const ACTOR_WALLET_PAYOUT_OPERATION_TYPE = 'actor_wallet_payout' as const;

/** reference_type canônico para bank_transactions (DECISION-0058 D5). */
export const ACTOR_WALLET_PAYOUT_REFERENCE_TYPE = 'actor_wallet_payout' as const;

/** Converter row do DB para tipo de domínio. */
export function toActorWalletPayoutRequest(
  row: ActorWalletPayoutRequestRow
): ActorWalletPayoutRequest {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    actorId: row.actor_id,
    actorWalletAccountId: row.actor_wallet_account_id,
    approvalRequestId: row.approval_request_id,
    requestedAmountCents: parseInt(row.requested_amount_cents, 10),
    approvedAmountCents:
      row.approved_amount_cents != null
        ? parseInt(row.approved_amount_cents, 10)
        : null,
    executedAmountCents:
      row.executed_amount_cents != null
        ? parseInt(row.executed_amount_cents, 10)
        : null,
    destinationType: row.destination_type,
    destinationKey: row.destination_key,
    settlementTransactionId: row.settlement_transaction_id,
    idempotencyKey: row.idempotency_key,
    status: row.status,
    failedReason: row.failed_reason,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
