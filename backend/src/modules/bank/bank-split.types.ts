// backend/src/modules/bank/bank-split.types.ts
// SPRINT 2: TRANSACTIONS + SPLIT ENGINE
// Tipos para splits do Unify Bank

import type { BankCurrency } from './bank-account.types';

/**
 * Tipo de split
 */
export type BankSplitType =
  | 'fee'              // Taxa da plataforma
  | 'regional_fund'    // Fundo regional
  | 'reserve'          // Reserva do sistema
  | 'escrow'           // Custódia
  | 'revenue_share'    // Participação na receita (organizador, worker, etc)
  | 'referral';        // Comissão de indicação

/**
 * Contexto da transação (determina regras de split)
 */
export type BankTransactionContext =
  | 'service_booking'   // Booking de serviço (3% fee)
  | 'event_ticket'     // Ingresso de evento (organizer + fee + regional_fund + reserve)
  | 'p2p_transfer'     // Transferência P2P (0% fee)
  | 'group_contribution' // Contribuição para grupo (0% fee)
  | 'ride_payment'     // Pagamento de corrida (3% fee, 97% driver)
  | 'deposit'          // Depósito
  | 'withdrawal';      // Saque

/**
 * Split do Unify Bank
 */
export interface BankSplit {
  splitId: string;
  tenantId: string;
  transactionId: string;
  serviceOrderId?: string | null;
  targetAccountId: string;
  /** Centavos inteiros > 0 (§4.7). */
  amountCents: number;
  percentage?: number | null;
  splitType: BankSplitType;
  description?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

/**
 * Input para criar um split
 */
export interface CreateBankSplitInput {
  transactionId: string;
  serviceOrderId?: string | null;
  targetAccountId: string;
  /** Centavos inteiros > 0 (§4.7). */
  amountCents: number;
  percentage?: number;
  splitType: BankSplitType;
  description?: string;
  metadata?: Record<string, any>;
  /**
   * Contexto de autoria (OBRIGATÓRIO - REGRA INQUEBRÁVEL)
   * Hard fail no código se não fornecido
   */
  authorship: import('./financial-authorship.types').FinancialAuthorshipContext;
}

/**
 * Configuração de split para um contexto
 */
export interface BankSplitConfig {
  context: BankTransactionContext;
  splits: Array<{
    splitType: BankSplitType;
    percentage: number;
    targetAccountName?: SystemAccountName; // Para contas do sistema
  }>;
}

/**
 * Resultado de cálculo de splits
 */
export interface BankSplitCalculation {
  /** Total da transação em centavos (inteiro). */
  totalAmountCents: number;
  splits: Array<{
    splitType: BankSplitType;
    targetAccountId: string;
    /** Centavos inteiros > 0 por linha (§4.7). */
    amountCents: number;
    /** Fração 0–1 do total (regra de negócio); não confundir com basis points. */
    percentage: number;
    metadata?: Record<string, any>;
  }>;
  /** Sobra em centavos após alocação (0 quando válido). */
  remainderCents?: number;
}

/**
 * Nome das contas do sistema
 */
export type SystemAccountName = 'fee' | 'regional_fund' | 'reserve' | 'escrow' | 'platform_ops';







