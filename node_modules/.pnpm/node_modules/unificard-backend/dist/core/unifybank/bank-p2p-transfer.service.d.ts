import type { TransferResult } from '@core/economy/transactions/transaction.types';
export interface P2PTransferParams {
    fromUserId: string;
    toUserId: string;
    amount: number;
    eventId: string;
}
export interface P2PTransferResult extends TransferResult {
    fromUserId: string;
    toUserId: string;
}
declare class BankP2PTransferService {
    /**
     * Executa transferência P2P entre dois usuários
     *
     * GARANTIAS:
     * - Transação SQL atômica (via transactionService)
     * - Validação de saldo (>= amount)
     * - Idempotência via eventId
     * - Ledger imutável (double-entry)
     * - fromUserId !== toUserId
     * - toUserId deve existir
     *
     * @param tenantId - ID do tenant
     * @param params - Parâmetros da transferência
     * @returns Resultado da transferência
     */
    transferP2P(tenantId: string, params: P2PTransferParams): Promise<P2PTransferResult>;
}
export declare const bankP2PTransferService: BankP2PTransferService;
export {};
//# sourceMappingURL=bank-p2p-transfer.service.d.ts.map