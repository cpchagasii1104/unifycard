"use strict";
// LEGACY TEMPORÁRIO — delega para bankAccountService.
// Remover após migração completa para Bank SSOT.
// Conforme SSOT_EXCLUSIVE_BANK_RULE.md
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountService = void 0;
const bank_account_service_1 = require("@modules/bank/bank-account.service");
class AccountService {
    // Conversão mínima e mecânica (sem semântica)
    toLegacyAccount(bankAccount) {
        return {
            accountId: bankAccount.accountId,
            tenantId: bankAccount.tenantId,
            ownerId: bankAccount.ownerId,
            ownerType: bankAccount.ownerType,
            balance: bankAccount.cachedBalance,
            currency: bankAccount.currency,
            createdAt: bankAccount.createdAt,
        };
    }
    async getOrCreateUserPrimaryAccount(tenantId, userId, currency = 'BRL') {
        const account = await bank_account_service_1.bankAccountService.getOrCreateAccount(tenantId, {
            ownerId: userId,
            ownerType: 'user',
            currency,
        });
        return this.toLegacyAccount(account);
    }
    async getOrCreateSystemAccount(tenantId, accountName, currency = 'BRL') {
        const account = await bank_account_service_1.bankAccountService.getOrCreateAccount(tenantId, {
            ownerId: accountName,
            ownerType: 'system',
            currency,
        });
        return this.toLegacyAccount(account);
    }
    async getAccountById(tenantId, accountId) {
        const account = await bank_account_service_1.bankAccountService.getAccountById(tenantId, accountId);
        return account ? this.toLegacyAccount(account) : null;
    }
    async getAccountsByOwner(tenantId, ownerId, ownerType) {
        const accounts = await bank_account_service_1.bankAccountService.searchAccounts(tenantId, {
            ownerId,
            ownerType,
        });
        return accounts.map(acc => this.toLegacyAccount(acc));
    }
    async createAccount(tenantId, input) {
        const account = await bank_account_service_1.bankAccountService.getOrCreateAccount(tenantId, input);
        return this.toLegacyAccount(account);
    }
}
exports.accountService = new AccountService();
