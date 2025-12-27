import type { Transaction, CreateTransactionInput, TransferResult } from './transaction.types';
declare class TransactionService {
    /**
     * Converte row do banco para objeto Transaction
     */
    private toTransaction;
    /**
     * Executa uma transferência atômica entre contas
     *
     * GARANTIAS:
     * - Transação SQL atômica (BEGIN...COMMIT)
     * - Validação de saldo
     * - Idempotência via event_id
     * - Double-entry bookkeeping no ledger
     * - Emissão de evento transaction.completed
     *
     * ROLLBACK automático em caso de:
     * - Saldo insuficiente
     * - Contas não encontradas
     * - Qualquer erro durante a transação
     */
    transfer(tenantId: string, input: CreateTransactionInput): Promise<TransferResult>;
    /**
     * Busca transação por ID
     */
    getTransactionById(tenantId: string, transactionId: string): Promise<Transaction | null>;
    /**
     * Busca transação por event_id (para idempotência)
     */
    getTransactionByEventId(tenantId: string, eventId: string): Promise<Transaction | null>;
    /**
     * Lista transações de uma conta
     */
    getTransactionsByAccount(tenantId: string, accountId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<Transaction[]>;
    /**
     * Busca transações de um global_user_id (agregado de todos os tenants)
     */
    getTransactionsByGlobalUserId(globalUserId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<Transaction[]>;
}
export declare const transactionService: TransactionService;
export {};
//# sourceMappingURL=transaction.service.d.ts.map