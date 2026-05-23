// backend/src/modules/ledger/ledger.repository.ts
// Stub: repositório do ledger (implementação persistência em outro módulo/camada)

import type {
  LedgerEntry,
  CreateLedgerEntryInput,
  LedgerEntryFilters,
  AccountBalance,
  ContextStatement,
} from './ledger.types';

async function createEntry(_tenantId: string, _input: CreateLedgerEntryInput): Promise<LedgerEntry> {
  throw new Error('ledger.repository.createEntry not implemented');
}

async function findById(_tenantId: string, _entryId: string): Promise<LedgerEntry | null> {
  return null;
}

async function listEntries(_tenantId: string, _filters: LedgerEntryFilters): Promise<LedgerEntry[]> {
  return [];
}

async function getAccountBalance(
  _tenantId: string,
  _accountId: string,
  _currency: string
): Promise<AccountBalance> {
  return {
    accountId: _accountId,
    currency: _currency,
    balanceCents: 0,
    totalDebitsCents: 0,
    totalCreditsCents: 0,
    entryCount: 0,
    lastEntryAt: null,
  };
}

async function getContextStatement(
  _tenantId: string,
  _contextType: string,
  _contextId: string
): Promise<{ entries: LedgerEntry[]; totalDebitsCents: number; totalCreditsCents: number; currency: string }> {
  return {
    entries: [],
    totalDebitsCents: 0,
    totalCreditsCents: 0,
    currency: 'BRL',
  };
}

export const ledgerRepository = {
  createEntry,
  findById,
  listEntries,
  getAccountBalance,
  getContextStatement,
};