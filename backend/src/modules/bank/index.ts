// backend/src/modules/bank/index.ts
// SPRINT 3: SYSTEM INTEGRATION WITH UNIFY BANK
// Exportações do módulo Bank

export { bankAccountService } from './bank-account.service';
export { bankTransactionService } from './bank-transaction.service';
export { bankAccountRepository } from './bank-account.repository';
export {
  bankLedgerRepository,
  getAccountBalanceConsistent,
} from './bank-ledger.repository';
export { bankSplitRepository } from './bank-split.repository';
export { bankSplitEngineService } from './bank-split-engine.service';
export { bankIntegrationService } from './bank-integration.service';
export {
  compensateTransaction,
  type CompensateTransactionResult,
} from './ledger-compensation.service';
export { bankLimitService } from './bank-limit.service';
export { bankLimitRepository } from './bank-limit.repository';

export {
  parseMoneyToCents,
  parsePositiveMoneyToCents,
  parseMajorDecimalToCents,
  formatCentsToMoney,
} from './bank-http-money';

export type {
  BankHttpBalanceResponseBody,
  BankHttpCreateSimpleTransactionBody,
  BankHttpCreateTransactionWithSplitBody,
  BankHttpEventPaymentBody,
  BankHttpPaymentWithSplitsResponseBody,
  BankHttpRequestLimitChangeBody,
} from './bank-http.contracts';

export type {
  BankAccount,
  CreateBankAccountInput,
  BankAccountSearchOptions,
  BankAccountOwnerType,
  BankCurrency,
  SystemAccountName,
} from './bank-account.types';

export type {
  BankLedgerEntry,
  CreateBankLedgerEntryInput,
  BankLedgerSearchOptions,
  BankAccountBalance,
  BankLedgerEntryType,
} from './bank-ledger.types';

export type {
  BankTransaction,
  CreateBankTransactionInput,
  BankTransferResult,
  BankTransactionType,
  BankTransactionStatus,
  TreasuryOperationSource,
} from './bank-transaction.types';

export type {
  BankSplit,
  CreateBankSplitInput,
  BankTransactionContext,
  BankSplitType,
  BankSplitCalculation,
  BankSplitConfig,
} from './bank-split.types';

export type {
  BankLimitChangeRequest,
  RequestLimitChangeInput,
  CurrentLimits,
  ActorLimit,
  BankLimitType,
  LimitChangeRequestStatus,
  AuthoritySource,
} from './bank-limit.types';


