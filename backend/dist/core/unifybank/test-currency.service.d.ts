interface EmitTestCurrencyInput {
    tenantId: string;
    userId: string;
    amount: number;
    reason: string;
    adminId: string;
}
interface EmitTestCurrencyResult {
    transactionId: string;
    accountId: string;
    newBalance: number;
    amount: number;
    reason: string;
    emittedAt: Date;
}
interface TestCurrencyLedgerEntry {
    entryId: string;
    transactionId: string;
    accountId: string;
    amount: number;
    reason: string;
    adminId: string;
    userId: string;
    createdAt: Date;
}
declare class TestCurrencyService {
    /**
     * Emite saldo fictício (TEST) para um usuário
     *
     * GARANTIAS:
     * - Apenas moeda TEST pode ser emitida
     * - Cria conta se não existir
     * - Registra transação no ledger
     * - Rastreabilidade completa
     */
    emitTestCurrency(input: EmitTestCurrencyInput): Promise<EmitTestCurrencyResult>;
    /**
     * Lista todas as emissões de TEST para um usuário
     * Busca no ledger todas as transações de emissão
     */
    getTestCurrencyLedger(tenantId: string, userId: string, limit?: number, offset?: number): Promise<{
        entries: TestCurrencyLedgerEntry[];
        total: number;
    }>;
    /**
     * Valida se a moeda é TEST (gate de segurança)
     */
    validateTestCurrency(currency: string): boolean;
}
export declare const testCurrencyService: TestCurrencyService;
export {};
//# sourceMappingURL=test-currency.service.d.ts.map