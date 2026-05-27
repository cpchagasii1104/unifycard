// backend/src/core/financial-recovery/financial-recovery.types.ts
//
// Tipos canônicos para recovery pós-D-money (DECISION-0053 + DECISION-0055, 2026-05-27).
// Substrato: 20260530570000_actor_wallet_recovery_obligations_substrate.sql
//
// Sem service nem repository — frentes C3 e C4 separadas.

export type ActorWalletRecoveryObligationStatus =
  | 'pending_approval'
  | 'approved'
  | 'partially_recovered'
  | 'recovered'      // terminal
  | 'cancelled'      // terminal
  | 'failed';        // terminal

export const ACTOR_WALLET_RECOVERY_OBLIGATION_TERMINAL_STATUSES: ActorWalletRecoveryObligationStatus[] =
  ['recovered', 'cancelled', 'failed'];

export interface ActorWalletRecoveryObligationRow {
  id: string;
  tenant_id: string;

  // Partes causais (imutáveis)
  debtor_actor_id: string;
  debtor_account_id: string;
  creditor_actor_id: string;
  creditor_account_id: string;

  // Origem causal (imutável)
  original_transaction_id: string;
  payment_intent_id: string;
  reversal_id: string | null;

  // Montante e justificativa (imutáveis)
  amount_cents: number;
  reason: string;

  // Campos operacionais
  status: ActorWalletRecoveryObligationStatus;
  recovered_amount_cents: number;
  approval_request_id: string | null;

  created_at: Date;
  updated_at: Date;
}

export interface ActorWalletRecoveryObligationEntryRow {
  id: string;
  tenant_id: string;
  obligation_id: string;
  recovery_transaction_id: string;
  amount_cents: number;
  created_at: Date;
}

export interface CreateActorWalletRecoveryObligationInput {
  tenantId: string;
  debtorActorId: string;
  debtorAccountId: string;
  creditorActorId: string;
  creditorAccountId: string;         // C4: caller resolve via payment_intent chain
  originalTransactionId: string;
  paymentIntentId: string;
  reversalId?: string;
  amountCents: number;
  reason: string;
  approvalRequestId?: string;        // preenchido após criação do approval_request
}

export interface CreateActorWalletRecoveryObligationEntryInput {
  tenantId: string;
  obligationId: string;
  recoveryTransactionId: string;     // FK → bank_transactions (execução real via debitActorWalletForRecovery)
  amountCents: number;
}
