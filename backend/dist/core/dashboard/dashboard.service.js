"use strict";
// src/core/dashboard/dashboard.service.ts
// Dashboard principal - agrega informações de múltiplas fontes
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardService = void 0;
const identity_service_1 = require("../identity/identity.service");
// import { fundVisibilityService } from '../economy/fund/fund-visibility.service'; // LEGACY: módulo desabilitado
const account_service_1 = require("../economy/account.service");
const transaction_service_1 = require("../economy/transaction.service");
const reputation_service_1 = require("../reputation/reputation.service");
class DashboardService {
    /**
     * Busca dados completos do dashboard para o usuário autenticado
     */
    async getDashboard(tenantId, userId) {
        // Buscar perfil completo
        const profile = await identity_service_1.identityService.getIdentityProfile(userId, tenantId);
        if (!profile) {
            throw new Error('Perfil não encontrado');
        }
        // Buscar fundo regional (LEGACY: módulo desabilitado)
        const fundData = null; // core/economy/fund desabilitado conforme SSOT_EXCLUSIVE_BANK_RULE.md
        // Buscar wallet (já existe em identity/wallet, mas vamos buscar diretamente)
        let wallet = null;
        if (profile.global.globalUserId) {
            try {
                const accounts = await account_service_1.accountService.getAccountsByGlobalUserId(profile.global.globalUserId);
                if (accounts.length > 0) {
                    const primaryAccount = accounts.find(acc => acc.currency === 'BRL') || accounts[0];
                    const transactions = await transaction_service_1.transactionService.getTransactionsByGlobalUserId(profile.global.globalUserId, { limit: 5 });
                    let totalIn = 0;
                    let totalOut = 0;
                    const lastTransactions = transactions.slice(0, 5).map(tx => {
                        const isCredit = tx.toGlobalUserId === profile.global.globalUserId;
                        const amount = tx.amount;
                        if (isCredit) {
                            totalIn += amount;
                        }
                        else {
                            totalOut += amount;
                        }
                        return {
                            transactionId: tx.transactionId,
                            type: isCredit ? 'credit' : 'debit',
                            amount,
                            createdAt: tx.createdAt,
                        };
                    });
                    wallet = {
                        balance: primaryAccount.balance,
                        currency: primaryAccount.currency,
                        totalIn,
                        totalOut,
                        lastTransactions,
                    };
                }
            }
            catch (error) {
                console.warn('[DashboardService] Erro ao buscar wallet:', error);
            }
        }
        // Buscar reputação (já existe em identity/reputation)
        let reputation = null;
        if (profile.global.globalUserId) {
            try {
                reputation = await reputation_service_1.reputationService.getScoreByGlobalUserId(profile.global.globalUserId);
            }
            catch (error) {
                console.warn('[DashboardService] Erro ao buscar reputação:', error);
            }
        }
        return {
            profile: {
                global: profile.global,
                local: profile.local,
                residence: profile.residence,
            },
            wallet,
            reputation,
            fund: fundData,
        };
    }
}
exports.dashboardService = new DashboardService();
