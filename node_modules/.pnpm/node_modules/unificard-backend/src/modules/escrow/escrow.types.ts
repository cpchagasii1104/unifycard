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
 * Escrow Account
 * 
 * REGRAS:
 * - Vinculado a Agreement FINALIZED (obrigatório)
 * - Valores vêm exclusivamente do Agreement
 * - Liberação por marcos explícitos
 * - Disputa aberta bloqueia RELEASE
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
  heldAmountCents: number; // Valor atualmente em hold
  releasedAmountCents: number; // Valor já liberado
  refundedAmountCents: number; // Valor reembolsado
  status: EscrowStatus;
  currentMilestone: PaymentMilestone | null;
  disputeStatus: 'none' | 'open' | 'resolved'; // Sincronizado com EvidencePack
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
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
}

/**
 * Input para reembolsar
 */
export interface RefundInput {
  amountCents: number;
  reason: string;
  refundedByActorId: string;
  refundedByUserId?: string | null;
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





