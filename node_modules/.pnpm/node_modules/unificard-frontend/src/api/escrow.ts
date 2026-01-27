// frontend/src/api/escrow.ts
// API client para Pagamentos com Escrow e Marcos de Execução
// 🔴 BLINDAGEM: Frontend NÃO calcula valores, apenas reflete estado

import { apiFetch, apiFetchJson } from './client';

/**
 * Status do escrow account
 */
export type EscrowStatus = 'PENDING' | 'FUNDS_HELD' | 'READY_TO_RELEASE' | 'RELEASED' | 'REFUNDED' | 'BLOCKED_BY_DISPUTE';

/**
 * Marco de pagamento
 */
export type PaymentMilestone = 'CONFIRMED' | 'STARTED' | 'COMPLETED';

/**
 * Tipo de transação escrow
 */
export type EscrowTransactionType = 'HOLD' | 'RELEASE' | 'REFUND';

/**
 * Escrow Account
 */
export interface EscrowAccount {
  escrowId: string;
  tenantId: string;
  agreementId: string;
  serviceOrderId: string | null;
  bundleId: string | null;
  evidencePackId: string | null;
  totalAmountCents: number;
  currency: string;
  heldAmountCents: number;
  releasedAmountCents: number;
  refundedAmountCents: number;
  status: EscrowStatus;
  currentMilestone: PaymentMilestone | null;
  disputeStatus: 'NONE' | 'OPEN' | 'RESOLVED';
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Payment Milestone
 */
export interface PaymentMilestoneRecord {
  milestoneId: string;
  escrowId: string;
  milestone: PaymentMilestone;
  amountCents: number;
  percentage: number;
  status: 'PENDING' | 'AUTHORIZED' | 'RELEASED';
  authorizedAt: string | null;
  releasedAt: string | null;
  authorizedByActorId: string | null;
  releasedByActorId: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Escrow Transaction
 */
export interface EscrowTransaction {
  transactionId: string;
  escrowId: string;
  milestoneId: string | null;
  transactionType: EscrowTransactionType;
  amountCents: number;
  currency: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  initiatedByActorId: string;
  completedAt: string | null;
  failureReason: string | null;
  bankTransactionId: string | null;
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
    percentage: number;
  }>;
}

/**
 * Input para autorizar milestone
 */
export interface AuthorizeMilestoneInput {
  milestone: PaymentMilestone;
  authorizedByActorId: string;
}

/**
 * Input para liberar pagamento
 */
export interface ReleasePaymentInput {
  milestone: PaymentMilestone;
  releasedByActorId: string;
  amountCents?: number;
}

/**
 * Input para reembolsar
 */
export interface RefundInput {
  amountCents: number;
  reason: string;
  refundedByActorId: string;
}

/**
 * Cria escrow account a partir de Agreement FINALIZED
 */
export async function createEscrowFromAgreement(input: CreateEscrowInput): Promise<EscrowAccount> {
  const response = await apiFetch('/escrow', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao criar escrow' }));
    throw new Error(error.error || 'Erro ao criar escrow');
  }

  const data = await response.json();
  return data.escrow;
}

/**
 * Busca escrow account por ID
 */
export async function getEscrowAccount(escrowId: string): Promise<EscrowAccount> {
  return apiFetchJson<EscrowAccount>(`/escrow/${escrowId}`);
}

/**
 * Busca escrow account por agreement
 */
export async function getEscrowByAgreement(agreementId: string): Promise<EscrowAccount | null> {
  try {
    const response = await apiFetch(`/escrow/agreement/${agreementId}`);
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error('Erro ao buscar escrow');
    }
    const data = await response.json();
    return data.escrow;
  } catch (error: any) {
    if (error.message?.includes('404') || error.message?.includes('não encontrado')) {
      return null;
    }
    throw error;
  }
}

/**
 * Lista milestones de um escrow
 */
export async function listMilestones(escrowId: string): Promise<PaymentMilestoneRecord[]> {
  const data = await apiFetchJson<{ milestones: PaymentMilestoneRecord[] }>(`/escrow/${escrowId}/milestones`);
  return data.milestones;
}

/**
 * Lista transações de um escrow
 */
export async function listTransactions(escrowId: string): Promise<EscrowTransaction[]> {
  const data = await apiFetchJson<{ transactions: EscrowTransaction[] }>(`/escrow/${escrowId}/transactions`);
  return data.transactions;
}

/**
 * Autoriza milestone
 */
export async function authorizeMilestone(
  escrowId: string,
  input: AuthorizeMilestoneInput
): Promise<PaymentMilestoneRecord> {
  const response = await apiFetch(`/escrow/${escrowId}/authorize-milestone`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao autorizar milestone' }));
    throw new Error(error.error || 'Erro ao autorizar milestone');
  }

  const data = await response.json();
  return data.milestone;
}

/**
 * Libera pagamento de um milestone
 */
export async function releasePayment(
  escrowId: string,
  input: ReleasePaymentInput
): Promise<{ escrow: EscrowAccount; transaction: EscrowTransaction }> {
  const response = await apiFetch(`/escrow/${escrowId}/release-payment`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao liberar pagamento' }));
    throw new Error(error.error || 'Erro ao liberar pagamento');
  }

  return response.json();
}

/**
 * Reembolsa fundos
 */
export async function refundFunds(
  escrowId: string,
  input: RefundInput
): Promise<{ escrow: EscrowAccount; transaction: EscrowTransaction }> {
  const response = await apiFetch(`/escrow/${escrowId}/refund`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao reembolsar' }));
    throw new Error(error.error || 'Erro ao reembolsar');
  }

  return response.json();
}




