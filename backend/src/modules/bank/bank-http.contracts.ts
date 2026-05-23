// backend/src/modules/bank/bank-http.contracts.ts
// Formas JSON canónicas na fronteira do módulo Bank (§4.7).
// Handlers HTTP (fora deste módulo) devem alinhar DTOs a estes tipos e usar bank-http-money para parse.

import type { BankCurrency } from './bank-account.types';
import type { BankTransactionType } from './bank-transaction.types';

/** Resposta de saldo: sempre centavos inteiros, nunca float monetário. */
export interface BankHttpBalanceResponseBody {
  balanceCents: number;
  currency: BankCurrency;
}

/** Corpo para criação de transação simples (espelha o port; montante só em centavos). */
export interface BankHttpCreateSimpleTransactionBody {
  eventId: string;
  referenceType: string;
  fromAccountId?: string;
  toAccountId?: string;
  amountCents: number;
  currency?: BankCurrency;
  transactionType: BankTransactionType;
  description?: string;
  metadata?: Record<string, unknown>;
}

/** Corpo para transação com split automático. */
export interface BankHttpCreateTransactionWithSplitBody {
  eventId: string;
  fromAccountId: string;
  amountCents: number;
  currency?: BankCurrency;
  context: string;
  revenueShareAccountId?: string;
  fromUserId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

/** Pagamento de ingresso / consumo em evento (integração). */
export interface BankHttpEventPaymentBody {
  eventId: string;
  buyerUserId: string;
  amountCents: number;
  currency?: BankCurrency;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

/** Resposta com splits: cada linha em centavos inteiros. */
export interface BankHttpPaymentWithSplitsResponseBody {
  transactionId: string;
  splits: Array<{ accountId: string; amountCents: number }>;
}

/** Pedido de alteração de limite (centavos inteiros). */
export interface BankHttpRequestLimitChangeBody {
  amountCents: number;
}