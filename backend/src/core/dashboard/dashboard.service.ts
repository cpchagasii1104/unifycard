// src/core/dashboard/dashboard.service.ts
// Dashboard principal - agrega informações de múltiplas fontes

import { identityService } from '../identity/identity.service';
// import { fundVisibilityService } from '../economy/fund/fund-visibility.service'; // LEGACY: módulo desabilitado
import { accountService } from '../economy/account.service';
import { transactionService } from '../economy/transaction.service';
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

    // Buscar fundo regional (LEGACY: módulo desabilitado)
    const fundData = null; // core/economy/fund desabilitado conforme SSOT_EXCLUSIVE_BANK_RULE.md

    // Buscar wallet via BankTransactionReadPort
    let wallet = null;
    try {
      const { socialPortsRegistry: socialPortsRegistry2 } = await import('@core/social/ports-registry');
      const actorRepository2 = socialPortsRegistry2.getActorRepository();
      const actor = await actorRepository2.findByUserId(tenantId, userId);

      if (actor) {
        const { bankPortsRegistry } = await import('@core/bank/ports-registry');
        const readPort = bankPortsRegistry.getBankTransactionRead();

        const [summary, recentTxs] = await Promise.all([
          readPort.getWalletSummaryByActorId(tenantId, actor.actor_id),
          readPort.listRecentTransactionsByActorId(tenantId, actor.actor_id, { limit: 5 }),
        ]);

        if (summary) {
          let totalInCents = 0;
          let totalOutCents = 0;
          const lastTransactions = recentTxs.map(tx => {
            if (tx.direction === 'credit') {
              totalInCents += tx.amountCents;
            } else {
              totalOutCents += tx.amountCents;
            }
            return {
              transactionId: tx.entryId,
              type: tx.direction,
              amountCents: tx.amountCents,
              createdAt: tx.createdAt.toISOString(),
            };
          });

          wallet = {
            balanceCents: summary.balanceCents,
            currency: summary.currency,
            totalInCents,
            totalOutCents,
            lastTransactions,
          };
        }
      }
    } catch (error) {
      console.warn('[DashboardService] Erro ao buscar wallet:', error);
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
