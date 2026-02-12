"use strict";
// LEGACY: Temporary wrapper for transaction service
// Delegates to bankTransactionService from @modules/bank
// TODO: Migrate callers to use bankTransactionService directly
Object.defineProperty(exports, "__esModule", { value: true });
exports.transactionService = void 0;
const bank_transaction_service_1 = require("@modules/bank/bank-transaction.service");
class TransactionService {
    async transfer(tenantId, input) {
        // LEGACY: Map old interface to new interface
        // Note: authorship is required but not provided in legacy calls
        // This is a temporary bridge - proper migration should provide authorship
        const authorship = {
            performedByUserId: 'system', // Legacy fallback
            actingForActorId: null,
            actingForAccountId: null,
            authoritySource: 'legacy',
            permissionSnapshot: null,
            policySnapshot: null,
        };
        return bank_transaction_service_1.bankTransactionService.transfer(tenantId, {
            eventId: input.eventId,
            fromAccountId: input.fromAccount,
            toAccountId: input.toAccount,
            amountCents: input.amountCents,
            currency: 'BRL',
            transactionType: 'transfer',
            description: `Legacy transfer: ${input.eventId}`,
            metadata: input.metadata,
            authorship,
        });
    }
}
exports.transactionService = new TransactionService();
