// backend/src/modules/bank/bank-split.types.ts
// SPRINT 2: TRANSACTIONS + SPLIT ENGINE
// Tipos para splits do Unify Bank

import type { BankCurrency } from './bank-account.types';

/**
 * Vocabulário canônico único dos tipos de split (DECISION-0180 / DECISION-0181).
 * `BANK_SPLIT_TYPES` é a FONTE (sourceSymbol) que porta os valores por autoridade;
 * `BankSplitType` é o tipo DERIVADO (derivedTypeSymbol), projeção exclusiva do tuple.
 * Fonte de VALOR, nunca autoridade financeira (o dinheiro vive no bank_ledger /
 * bank_splits). A ordem viva dos seis valores é preservada literalmente; a
 * extensão 6→7 (tax_reserve) pertence exclusivamente à retomada da FISCAL-4E.
 */
export const BANK_SPLIT_TYPES = [
  'fee',            // Taxa da plataforma
  'regional_fund',  // Fundo regional
  'reserve',        // Reserva do sistema
  'escrow',         // Custódia
  'revenue_share',  // Participação na receita (organizador, worker, etc)
  'referral',       // Comissão de indicação
  'tax_reserve',    // FISCAL-4E: reserva fiscal interna estimada sobre commission_gross (DECISION-0179 D5)
] as const;

/**
 * Tipo de split — DERIVADO do tuple canônico acima (nunca redeclarar a union).
 */
export type BankSplitType = (typeof BANK_SPLIT_TYPES)[number];

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
   * DECISION-0166 D5 (F1-c): FK para a VERSÃO exata de economic_policies que decidiu
   * este split (versão congelada pelos triggers de imutabilidade). NULL = split fora
   * do pipeline de policy canônico (legado/HOLD).
   */
  policyVersionId?: string | null;
  /**
   * DECISION-0166 D5 (F1-c): snapshot imutável da jurisdição resolvida no momento da
   * transação (IDs territoriais canônicos + basis). Contrato nullable — preenchido a
   * partir das Fases 2-3 (resolver regional por FK). NUNCA texto livre de geografia.
   */
  jurisdictionSnapshot?: Record<string, any> | null;
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







