import type { LedgerEntry, AccountSummary, LedgerSearchOptions } from './ledger.types';
declare class LedgerService {
    /**
     * Converte row do banco para objeto LedgerEntry
     */
    private toLedgerEntry;
    /**
     * Busca entradas do ledger de uma conta
     *
     * O ledger é IMUTÁVEL - uma vez criado, nunca é alterado.
     * Isso garante auditabilidade completa de todas transações.
     */
    getLedgerEntries(tenantId: string, accountId: string, options?: LedgerSearchOptions): Promise<LedgerEntry[]>;
    /**
     * Busca uma entrada específica do ledger
     */
    getLedgerEntry(tenantId: string, entryId: string): Promise<LedgerEntry | null>;
    /**
     * Busca todas as entradas de uma transação
     * Uma transação sempre tem 2 entradas: débito e crédito
     */
    getLedgerEntriesByTransaction(tenantId: string, transactionId: string): Promise<LedgerEntry[]>;
    /**
     * Gera sumário de movimentação de uma conta
     *
     * Calcula:
     * - Total de créditos
     * - Total de débitos
     * - Saldo líquido
     * - Número de transações
     */
    getAccountSummary(tenantId: string, accountId: string, options?: {
        startDate?: Date;
        endDate?: Date;
    }): Promise<AccountSummary>;
    /**
     * Verifica integridade do ledger de uma conta
     *
     * Valida que:
     * - Cada entrada tem balance_after = balance_before +/- amount
     * - O saldo atual da conta corresponde ao último balance_after
     *
     * Retorna true se tudo estiver correto, false se houver inconsistência
     */
    verifyLedgerIntegrity(tenantId: string, accountId: string): Promise<boolean>;
}
export declare const ledgerService: LedgerService;
export {};
//# sourceMappingURL=ledger.service.d.ts.map