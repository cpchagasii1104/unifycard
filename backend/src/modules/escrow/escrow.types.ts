// backend/src/modules/escrow/escrow.types.ts
// Camada de Pagamentos com Escrow e Marcos de Execução
// 🔴 BLINDAGEM: Nenhum pagamento sem Agreement FINALIZED
// 🔴 BLINDAGEM: Valores vêm exclusivamente do Agreement
// 🔴 BLINDAGEM: Nenhuma automação silenciosa

/**
 * Status do escrow account
 */
export type EscrowStatus = 'pending' | 'funds_held' | 'ready_to_release' | 'released' | 'refunded' | 'blocked_by_dispute';

/**
 * Marco de pagamento
 */
export type PaymentMilestone = 'confirmed' | 'started' | 'completed';

/**
 * Tipo de transação escrow
 */
export type EscrowTransactionType = 'hold' | 'release' | 'refund';

/**
 * Posição financeira (Fase 2) — saldo custody no bank vs campos legacy em `escrow_accounts`.
 */
export interface EscrowFinancialPosition {
  bank_custody_cents: number;
  legacy_held_cents: number;
  divergence_cents: number;
  total_contract_cents: number;
  released_cents: number;
  refunded_cents: number;
  /** Negócio: total − released − refunded (não substitui saldo em bank_ledger). */
  contractual_remainder_cents: number;
  escrow_bank_account_id: string;
  read_source: 'bank_primary';
}

/**
 * Escrow Account
 * 
 * REGRAS:
 * - Vinculado a Agreement FINALIZED (obrigatório)
 * - Valores vêm exclusivamente do Agreement
 * - Liberação por marcos explícitos
 * - Disputa aberta bloqueia RELEASE
 *
 * Fase 2: com `ESCROW_READ_FROM_BANK`, `heldAmountCents` reflecte saldo bank (custody);
 * `financialPosition` conserva legacy e divergência para auditoria.
 */
export interface EscrowAccount {
  escrowId: string;
  tenantId: string;
  agreementId: string; // Agreement FINALIZED obrigatório
  serviceOrderId: string | null; // Opcional: pode ser bundle
  bundleId: string | null; // Opcional: se for bundle
  evidencePackId: string | null; // Vinculado ao evidence pack
  totalAmountCents: number; // Valor total do acordo
  currency: string;
  heldAmountCents: number; // Valor em hold (Fase 2: pode vir do bank quando flag activa)
  releasedAmountCents: number; // Valor já liberado
  refundedAmountCents: number; // Valor reembolsado
  status: EscrowStatus;
  currentMilestone: PaymentMilestone | null;
  disputeStatus: 'none' | 'open' | 'resolved'; // Sincronizado com EvidencePack
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
  /** Preenchido quando `ESCROW_READ_FROM_BANK` está activo. */
  financialPosition?: EscrowFinancialPosition;
}

/**
 * Payment Milestone
 * 
 * REGRAS:
 * - Cada milestone tem valor e status
 * - Transições são validadas
 * - Histórico imutável
 */
export interface PaymentMilestoneRecord {
  milestoneId: string;
  escrowId: string;
  milestone: PaymentMilestone;
  amountCents: number;
  percentage: number; // % do total
  status: 'pending' | 'authorized' | 'released';
  authorizedAt: Date | null;
  releasedAt: Date | null;
  authorizedByActorId: string | null;
  releasedByActorId: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Escrow Transaction
 * 
 * REGRAS:
 * - Append-only: todas as transações são registradas
 * - Imutável após criação
 * - Vinculada a milestone
 */
export interface EscrowTransaction {
  transactionId: string;
  escrowId: string;
  milestoneId: string | null;
  transactionType: EscrowTransactionType;
  amountCents: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  initiatedByActorId: string;
  completedAt: Date | null;
  failureReason: string | null;
  bankTransactionId: string | null; // ID da transação bancária
  metadata: Record<string, any> | null;
  createdAt: string;
}

/**
 * Input para criar escrow account
 */
export interface CreateEscrowInput {
  agreementId: string;
  serviceOrderId?: string | null;
  bundleId?: string | null;
  milestones: Array<{
    milestone: PaymentMilestone;
    percentage: number; // % do total
  }>;
}

/**
 * Input para autorizar milestone
 */
export interface AuthorizeMilestoneInput {
  milestone: PaymentMilestone;
  authorizedByActorId: string;
  authorizedByUserId?: string | null;
}

/**
 * Input para liberar pagamento
 */
export interface ReleasePaymentInput {
  milestone: PaymentMilestone;
  releasedByActorId: string;
  releasedByUserId?: string | null;
  amountCents?: number; // Opcional: se não fornecido, usa valor do milestone
  /**
   * Com `ESCROW_BANK_BRIDGE=1`: conta bank de destino (UUID) para `transfer` após débito da conta escrow.
   */
  toBankAccountId?: string;
}

/**
 * Input para reembolsar
 */
export interface RefundInput {
  amountCents: number;
  reason: string;
  refundedByActorId: string;
  refundedByUserId?: string | null;
  /**
   * Com `ESCROW_BANK_BRIDGE=1`: conta bank de destino do reembolso (ex.: wallet do pagador).
   */
  toBankAccountId?: string;
  /** Opcional: idempotência de refund entre retries (recomendado em produção). */
  idempotencyKey?: string;
}

/**
 * Filtros para buscar escrow accounts
 */
export interface EscrowFilters {
  agreementId?: string;
  serviceOrderId?: string;
  bundleId?: string;
  status?: EscrowStatus;
  disputeStatus?: 'none' | 'open' | 'resolved';
  limit?: number;
  offset?: number;
}





