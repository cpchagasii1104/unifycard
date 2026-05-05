// src/core/bank/ports-registry.ts
/**
 * Registry: Bank Ports
 * 
 * Mantém referências para implementações injetadas.
 * Core usa este registry, não importa modules diretamente.
 * 
 * Ver: ARCHITECTURAL_SOURCE_OF_TRUTH.md
 */

import type {
  BankAccountPort,
  BankTransactionPort,
  BankTransactionReadPort,
  BankIntegrationPort,
  BankLimitPort,
} from './ports';

class BankPortsRegistry {
  private bankAccount?: BankAccountPort;
  private bankTransaction?: BankTransactionPort;
  private bankTransactionRead?: BankTransactionReadPort;
  private bankIntegration?: BankIntegrationPort;
  private bankLimit?: BankLimitPort;

  // Bank Account
  setBankAccount(adapter: BankAccountPort) {
    this.bankAccount = adapter;
  }

  getBankAccount(): BankAccountPort {
    if (!this.bankAccount) {
      throw new Error(
        'BankAccount não foi injetado. ' +
        'Configurar em bootstrap antes de usar.'
      );
    }
    return this.bankAccount;
  }

  // Bank Transaction
  setBankTransaction(adapter: BankTransactionPort) {
    this.bankTransaction = adapter;
  }

  getBankTransaction(): BankTransactionPort {
    if (!this.bankTransaction) {
      throw new Error(
        'BankTransaction não foi injetado. ' +
        'Configurar em bootstrap antes de usar.'
      );
    }
    return this.bankTransaction;
  }

  // Bank Transaction Read
  setBankTransactionRead(adapter: BankTransactionReadPort) {
    this.bankTransactionRead = adapter;
  }

  getBankTransactionRead(): BankTransactionReadPort {
    if (!this.bankTransactionRead) {
      throw new Error(
        'BankTransactionRead não foi injetado. ' +
        'Configurar em bootstrap antes de usar.'
      );
    }
    return this.bankTransactionRead;
  }

  // Bank Integration
  setBankIntegration(adapter: BankIntegrationPort) {
    this.bankIntegration = adapter;
  }

  getBankIntegration(): BankIntegrationPort {
    if (!this.bankIntegration) {
      throw new Error(
        'BankIntegration não foi injetado. ' +
        'Configurar em bootstrap antes de usar.'
      );
    }
    return this.bankIntegration;
  }

  // Bank Limit
  setBankLimit(adapter: BankLimitPort) {
    this.bankLimit = adapter;
  }

  getBankLimit(): BankLimitPort {
    if (!this.bankLimit) {
      throw new Error(
        'BankLimit não foi injetado. ' +
        'Configurar em bootstrap antes de usar.'
      );
    }
    return this.bankLimit;
  }
}

export const bankPortsRegistry = new BankPortsRegistry();





