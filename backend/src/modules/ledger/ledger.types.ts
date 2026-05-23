// backend/src/modules/ledger/ledger.types.ts
// Ledger Contábil Canônico (Payout-Ready)
// 🔴 BLINDAGEM: Append-only, imutável após criação
// 🔴 BLINDAGEM: Tudo amarrado a EvidencePack

/**
 * Tipo de entrada no ledger
 */
export type LedgerEntryType =
  | 'ESCROW_HOLD' // Fundos retidos em escrow
  | 'ESCROW_RELEASE' // Fundos liberados do escrow
  | 'ESCROW_REFUND' // Reembolso de escrow
  | 'SPLIT_CREATED' // Split criado (distribuição)
  | 'COMMISSION_FEE' // Taxa de comissão da plataforma
  | 'PAYOUT_REQUESTED' // Solicitação de payout (futuro)
  | 'PAYOUT_EXECUTED'; // Payout executado (futuro)

/**
 * Tipo de contexto da entrada
 */
export type LedgerContextType = 'event' | 'agreement' | 'booking' | 'service_order' | 'escrow' | 'split';

/**
 * Ledger Entry
 * 
 * REGRAS:
 * - Append-only: entradas são adicionadas, nunca removidas
 * - Imutável após criação
 * - Sempre vinculado a EvidencePack
 * - Double-entry: debitAccountId e creditAccountId
 */
export interface LedgerEntry {
  entryId: string;
  tenantId: string;
  timestamp: Date; // Imutável
  debitAccountId: string; // Conta que recebe débito
  creditAccountId: string; // Conta que recebe crédito
  amountCents: number;
  currency: string;
  entryType: LedgerEntryType;
  contextType: LedgerContextType;
  contextId: string;
  evidencePackId: string; // Obrigatório
  metadata: Record<string, any> | null; // splitIds, escrowId, agreementId, etc.
  createdAt: string;
}

/**
 * Input para criar entrada no ledger
 */
export interface CreateLedgerEntryInput {
  debitAccountId: string;
  creditAccountId: string;
  amountCents: number;
  currency: string;
  entryType: LedgerEntryType;
  contextType: LedgerContextType;
  contextId: string;
  evidencePackId: string;
  metadata?: Record<string, any>;
}

/**
 * Filtros para buscar entradas do ledger
 */
export interface LedgerEntryFilters {
  accountId?: string; // Buscar por debitAccountId ou creditAccountId
  contextType?: LedgerContextType;
  contextId?: string;
  entryType?: LedgerEntryType | 'credit' | 'debit'; // API query aceita credit/debit para filtro por lado
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Saldo de conta (calculado, não persistido)
 */
export interface AccountBalance {
  accountId: string;
  currency: string;
  balanceCents: number; // Positivo = crédito, Negativo = débito
  totalDebitsCents: number;
  totalCreditsCents: number;
  entryCount: number;
  lastEntryAt: Date | null;
}

/**
 * Extrato por contexto
 */
export interface ContextStatement {
  contextType: LedgerContextType;
  contextId: string;
  entries: LedgerEntry[];
  totalDebitsCents: number;
  totalCreditsCents: number;
  netAmountCents: number;
  currency: string;
}





