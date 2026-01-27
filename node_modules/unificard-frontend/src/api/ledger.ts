// frontend/src/api/ledger.ts
// API client para Ledger Contábil Canônico
// 🔴 BLINDAGEM: Frontend apenas exibe, não calcula

import { apiFetchJson } from './client';

/**
 * Tipo de entrada no ledger
 */
export type LedgerEntryType =
  | 'ESCROW_HOLD'
  | 'ESCROW_RELEASE'
  | 'ESCROW_REFUND'
  | 'SPLIT_CREATED'
  | 'COMMISSION_FEE'
  | 'PAYOUT_REQUESTED'
  | 'PAYOUT_EXECUTED';

/**
 * Ledger Entry
 */
export interface LedgerEntry {
  entryId: string;
  tenantId: string;
  timestamp: string;
  debitAccountId: string;
  creditAccountId: string;
  amountCents: number;
  currency: string;
  entryType: LedgerEntryType;
  contextType: string;
  contextId: string;
  evidencePackId: string;
  metadata: Record<string, any> | null;
  createdAt: string;
}

/**
 * Account Balance
 */
export interface AccountBalance {
  accountId: string;
  currency: string;
  balanceCents: number;
  totalDebitsCents: number;
  totalCreditsCents: number;
  entryCount: number;
  lastEntryAt: string | null;
}

/**
 * Context Statement
 */
export interface ContextStatement {
  contextType: string;
  contextId: string;
  entries: LedgerEntry[];
  totalDebitsCents: number;
  totalCreditsCents: number;
  netAmountCents: number;
  currency: string;
}

/**
 * Lista entradas do ledger
 */
export async function listLedgerEntries(filters: {
  accountId?: string;
  contextType?: string;
  contextId?: string;
  entryType?: LedgerEntryType;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): Promise<LedgerEntry[]> {
  const queryParams = new URLSearchParams();
  if (filters.accountId) queryParams.append('accountId', filters.accountId);
  if (filters.contextType) queryParams.append('contextType', filters.contextType);
  if (filters.contextId) queryParams.append('contextId', filters.contextId);
  if (filters.entryType) queryParams.append('entryType', filters.entryType);
  if (filters.startDate) queryParams.append('startDate', filters.startDate);
  if (filters.endDate) queryParams.append('endDate', filters.endDate);
  if (filters.limit) queryParams.append('limit', filters.limit.toString());
  if (filters.offset) queryParams.append('offset', filters.offset.toString());

  const data = await apiFetchJson<{ entries: LedgerEntry[] }>(`/ledger/entries?${queryParams.toString()}`);
  return data.entries;
}

/**
 * Calcula saldo de uma conta
 */
export async function getAccountBalance(accountId: string, currency?: string): Promise<AccountBalance> {
  const queryParams = currency ? `?currency=${currency}` : '';
  const data = await apiFetchJson<{ balance: AccountBalance }>(`/ledger/accounts/${accountId}/balance${queryParams}`);
  return data.balance;
}

/**
 * Busca extrato por contexto
 */
export async function getContextStatement(contextType: string, contextId: string): Promise<ContextStatement> {
  const data = await apiFetchJson<{ statement: ContextStatement }>(`/ledger/context/${contextType}/${contextId}`);
  return data.statement;
}




