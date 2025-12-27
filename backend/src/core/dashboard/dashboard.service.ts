// src/core/dashboard/dashboard.service.ts
// Dashboard principal - agrega informações de múltiplas fontes

import { identityService } from '../identity/identity.service';
import { fundVisibilityService } from '../economy/fund/fund-visibility.service';
import { accountService } from '../economy/accounts/account.service';
import { transactionService } from '../economy/transactions/transaction.service';
import { reputationService } from '../reputation/reputation.service';
import type { DashboardData } from './dashboard.types';

class DashboardService {
  /**
   * Busca dados completos do dashboard para o usuário autenticado
   */
  async getDashboard(tenantId: string, userId: string): Promise<DashboardData> {
    // Buscar perfil completo
    const profile = await identityService.getIdentityProfile(userId, tenantId);

    if (!profile) {
      throw new Error('Perfil não encontrado');
    }

    // Buscar fundo regional (já existe)
    let fundData = null;
    try {
      fundData = await fundVisibilityService.getCompleteView(tenantId, 30);
    } catch (error) {
      // Silenciosamente ignora erros ao buscar fundo
      console.warn('[DashboardService] Erro ao buscar fundo regional:', error);
    }

    // Buscar wallet (já existe em identity/wallet, mas vamos buscar diretamente)
    let wallet = null;
    if (profile.global.globalUserId) {
      try {
        const accounts = await accountService.getAccountsByGlobalUserId(profile.global.globalUserId);
        if (accounts.length > 0) {
          const primaryAccount = accounts.find(acc => acc.currency === 'BRL') || accounts[0];
          const transactions = await transactionService.getTransactionsByGlobalUserId(
            profile.global.globalUserId,
            { limit: 5 }
          );

          let totalIn = 0;
          let totalOut = 0;
          const lastTransactions = transactions.slice(0, 5).map(tx => {
            const isCredit = tx.toGlobalUserId === profile.global.globalUserId;
            const amount = tx.amount;
            
            if (isCredit) {
              totalIn += amount;
            } else {
              totalOut += amount;
            }

            return {
              transactionId: tx.transactionId,
              type: isCredit ? 'credit' as const : 'debit' as const,
              amount,
              createdAt: tx.createdAt.toISOString(),
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
      } catch (error) {
        console.warn('[DashboardService] Erro ao buscar wallet:', error);
      }
    }

    // Buscar reputação (já existe em identity/reputation)
    let reputation = null;
    if (profile.global.globalUserId) {
      try {
        reputation = await reputationService.getScoreByGlobalUserId(profile.global.globalUserId);
      } catch (error) {
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

export const dashboardService = new DashboardService();

