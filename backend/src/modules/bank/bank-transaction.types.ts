// backend/src/modules/bank/bank-transaction.types.ts
// SPRINT 1: FUNDAÇÃO DO UNIFY BANK
// Tipos para transações do Unify Bank

import type { MoneyCents } from '@contracts/marketplace/canonical';
import type { BankCurrency } from './bank-account.types';

/**
 * Tipo de transação
 */
export type BankTransactionType =
  | 'transfer'      // Transferência entre contas
  | 'deposit'       // Depósito
  | 'withdrawal'    // Saque
  | 'reversal'      // Reversão de transação anterior
  | 'fee'           // Taxa
  | 'split'          // Split (Sprint 2)
  | 'escrow'        // Custódia
  | 'release';      // Liberação de custódia

/**
 * Status da transação
 */
export type BankTransactionStatus = 'pending' | 'completed' | 'failed' | 'reversed';

/**
 * Transação do Unify Bank
 */
export interface BankTransaction {
  transactionId: string;
  tenantId: string;
  eventId: string; // Para idempotência
  fromAccountId?: string | null;
  toAccountId?: string | null;
  /** Montante em centavos (inteiro > 0). §4.7 — converter na fronteira com toPositiveMoneyCents. */
  amountCents: number;
  currency: BankCurrency;
  transactionType: BankTransactionType;
  originalTransactionId?: string | null; // Para reversões
  status: BankTransactionStatus;
  description?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
  settledAt?: Date | null;
}

/**
 * Tag de origem obrigatória quando a conta de origem é system (treasury).
 * Garante isolamento e execution boundaries (Prompt 50).
 */
export type TreasuryOperationSource =
  | 'treasury:distribution'
  | 'treasury:governance'
  | 'treasury:settlement'
  /** Apenas ambientes não-produção (simulador financeiro interno); nunca equivale a settlement real */
  | 'treasury:simulation'
  /** Reversão financeira: movimento inverso quando a origem da transfer é conta system (Prompt 51) */
  | 'treasury:reversal';

/**
 * Input para criar uma transação
 */
export interface CreateBankTransactionInput {
  eventId: string; // Para idempotência
  fromAccountId?: string;
  toAccountId?: string;
  /** Centavos inteiros > 0 (§4.7). */
  amountCents: number;
  currency?: BankCurrency;
  transactionType: BankTransactionType;
  originalTransactionId?: string; // Para reversões
  description?: string;
  metadata?: Record<string, any>;
  /**
   * Referência externa obrigatória (FASE 5.5). UNIQUE(tenant_id, reference_type, reference_id) para idempotência.
   */
  referenceType: string;
  referenceId: string;
  /**
   * C56: FK para orders.id — rastreabilidade de receita marketplace.
   * OBRIGATÓRIO para fluxos de receita (escrow, settlement, dispute_release).
   * Opcional/NULL para fluxos pós-receita (payout) e sistema (tesouraria).
   */
  orderId?: string;
  /**
   * Obrigatório quando fromAccount é system (treasury). Define o fluxo autorizado.
   * treasury:distribution = treasury split / distribution
   * treasury:governance = governance funding commitment (treasury → escrow)
   * treasury:settlement = settlement pipeline (escrow → seller_*, seller_* → payout, etc.)
   * treasury:simulation = apenas dev/staging (financial-simulator); bloqueado em produção
   */
  treasurySource?: TreasuryOperationSource;
  /**
   * Contexto de autoria (OBRIGATÓRIO - REGRA INQUEBRÁVEL)
   * Hard fail no código se não fornecido
   */
  authorship: import('./financial-authorship.types').FinancialAuthorshipContext;
}

/**
 * Resultado de uma transferência
 */
export interface BankTransferResult {
  transactionId: string;
  fromAccountId: string;
  toAccountId: string;
  /** Centavos inteiros > 0 (§4.7). */
  amountCents: number;
  currency: BankCurrency;
  /** Saldo após transferência (centavos, tipo nominal). */
  fromBalanceCents: MoneyCents;
  toBalanceCents: MoneyCents;
  ledgerEntries: {
    fromEntry: string; // entryId do débito
    toEntry: string;   // entryId do crédito
  };
}









