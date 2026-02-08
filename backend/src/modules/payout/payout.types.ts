// backend/src/modules/payout/payout.types.ts
// Payout Engine - Execução Financeira Controlada
// 🔴 BLINDAGEM: Nenhum payout sem validação completa
// 🔴 BLINDAGEM: Tudo amarrado a EvidencePack e Audit

/**
 * Status do payout
 */
export type PayoutStatus = 'PENDING' | 'READY' | 'BLOCKED' | 'EXECUTED' | 'FAILED';

/**
 * Método de payout
 */
export type PayoutMethod = 'MANUAL' | 'BANK_TRANSFER' | 'PIX' | 'FUTURE_PROVIDER';

/**
 * Payout Batch (Lote de Payouts)
 * 
 * REGRAS:
 * - Agrupa múltiplos payout orders
 * - Permite processamento em lote
 * - Append-only em eventos
 */
export interface PayoutBatch {
  batchId: string;
  tenantId: string;
  status: PayoutStatus;
  totalAmountCents: number;
  currency: string;
  orderCount: number;
  executedCount: number;
  failedCount: number;
  blockedCount: number;
  evidencePackId: string; // Obrigatório
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
  executedAt: Date | null;
}

/**
 * Payout Order (Ordem de Payout Individual)
 * 
 * REGRAS:
 * - Sempre referenciado a ledger entries
 * - Validações obrigatórias antes de executar
 * - Append-only em eventos
 */
export interface PayoutOrder {
  orderId: string;
  tenantId: string;
  batchId: string | null;
  actorId: string; // Beneficiário
  amountCents: number;
  currency: string;
  status: PayoutStatus;
  payoutMethod: PayoutMethod;
  ledgerEntryIds: string[]; // Entradas do ledger que originam este payout
  escrowId: string | null; // Quando aplicável
  agreementId: string | null; // Quando aplicável
  evidencePackId: string; // Obrigatório
  blockReason: string | null; // Motivo do bloqueio (se BLOCKED)
  executionMetadata: Record<string, any> | null; // Dados de execução (quando EXECUTED)
  failureReason: string | null; // Motivo da falha (se FAILED)
  executedAt: Date | null;
  failedAt: Date | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input para criar payout batch
 */
export interface CreatePayoutBatchInput {
  actorIds?: string[]; // Se fornecido, cria orders apenas para estes actors
  startDate?: Date; // Filtrar ledger entries a partir desta data
  endDate?: Date; // Filtrar ledger entries até esta data
  minAmountCents?: number; // Valor mínimo por order
  currency?: string;
  payoutMethod?: PayoutMethod;
}

/**
 * Input para executar payout manual
 */
export interface ExecutePayoutManualInput {
  executedByActorId: string;
  executedByUserId?: string | null;
  executionMetadata?: Record<string, any>; // Dados de execução (ex: comprovante)
}

/**
 * Input para marcar payout como falho
 */
export interface FailPayoutInput {
  failedByActorId: string;
  failedByUserId?: string | null;
  failureReason: string;
}

/**
 * Resultado da validação de elegibilidade
 */
export interface PayoutEligibilityResult {
  eligible: boolean;
  reasons: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';
  trustScore: number;
  hasOpenDispute: boolean;
  escrowStatus?: string;
  agreementStatus?: string;
}

/**
 * Filtros para buscar payout batches
 */
export interface PayoutBatchFilters {
  status?: PayoutStatus;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Filtros para buscar payout orders
 */
export interface PayoutOrderFilters {
  batchId?: string;
  actorId?: string;
  status?: PayoutStatus;
  payoutMethod?: PayoutMethod;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}





