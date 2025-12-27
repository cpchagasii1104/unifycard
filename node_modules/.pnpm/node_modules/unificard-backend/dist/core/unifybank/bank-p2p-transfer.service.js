"use strict";
// backend/src/core/unifybank/bank-p2p-transfer.service.ts
// Serviço de transferência P2P entre usuários
Object.defineProperty(exports, "__esModule", { value: true });
exports.bankP2PTransferService = void 0;
const account_service_1 = require("@core/economy/accounts/account.service");
const transaction_service_1 = require("@core/economy/transactions/transaction.service");
const identity_utils_1 = require("@core/identity/identity.utils");
class BankP2PTransferService {
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
    async transferP2P(tenantId, params) {
        const { fromUserId, toUserId, amount, eventId } = params;
        // 1. Validações básicas
        if (amount <= 0) {
            const error = new Error('Amount must be greater than zero');
            error.statusCode = 400;
            throw error;
        }
        if (fromUserId === toUserId) {
            const error = new Error('Cannot transfer to yourself');
            error.statusCode = 400;
            throw error;
        }
        // 2. Verificar se toUserId existe (buscar global_user_id)
        const toGlobalUserId = await (0, identity_utils_1.resolveGlobalUserId)(toUserId, tenantId);
        if (!toGlobalUserId) {
            const error = new Error('Destination user not found');
            error.statusCode = 404;
            throw error;
        }
        // 3. Buscar ou criar contas dos usuários
        const fromAccount = await account_service_1.accountService.getOrCreateUserPrimaryAccount(tenantId, fromUserId, 'BRL');
        const toAccount = await account_service_1.accountService.getOrCreateUserPrimaryAccount(tenantId, toUserId, 'BRL');
        // 4. Validar saldo do remetente (deve ser >= amount)
        if (fromAccount.balance < amount) {
            const error = new Error('Insufficient balance');
            error.statusCode = 400;
            throw error;
        }
        // 5. Executar transferência usando o transactionService existente
        // Isso garante transação atômica, locks, idempotência e ledger
        const result = await transaction_service_1.transactionService.transfer(tenantId, {
            fromAccount: fromAccount.accountId,
            toAccount: toAccount.accountId,
            amount,
            eventId,
            metadata: {
                type: 'p2p_transfer',
                fromUserId,
                toUserId,
            },
        });
        return {
            ...result,
            fromUserId,
            toUserId,
        };
    }
}
exports.bankP2PTransferService = new BankP2PTransferService();
//# sourceMappingURL=bank-p2p-transfer.service.js.map