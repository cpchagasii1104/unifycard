// backend/src/modules/bank/index.ts
// SPRINT 3: SYSTEM INTEGRATION WITH UNIFY BANK
// Exportações do módulo Bank

export { bankAccountService } from './bank-account.service';
export { bankTransactionService } from './bank-transaction.service';
export { bankAccountRepository } from './bank-account.repository';
export { bankLedgerRepository } from './bank-ledger.repository';
export { bankSplitRepository } from './bank-split.repository';
export { bankSplitEngineService } from './bank-split-engine.service';
export { bankIntegrationService } from './bank-integration.service';
export { bankLimitService } from './bank-limit.service';
export { bankLimitRepository } from './bank-limit.repository';

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


