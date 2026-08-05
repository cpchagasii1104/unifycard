// backend/src/modules/bank/bank-split-engine.service.ts
// SPRINT 2: TRANSACTIONS + SPLIT ENGINE
// CONTINUOUS PRODUCTION: Extended with referral + group allocation
// Engine de splits do Unify Bank

import { bankAccountService } from './bank-account.service';
import { getActiveReferral } from '@core/referral/referral-helper.service';
import { userGroupAllocationRepository } from '@core/user-group-allocation/user-group-allocation.repository';
import type {
  BankTransactionContext,
  BankSplitCalculation,
  BankSplitType,
  SystemAccountName,
} from './bank-split.types';
import type { BankCurrency } from './bank-account.types';

// DECISION-0048 (2026-05-26): bank-policy.service NÃO é mais fonte de
// policy de split. Engine usa apenas defaults hardcoded por contexto
// até cutover completo de event_ticket/ride/p2p/group para
// economic_policy_engine (PE-3+). NÃO reintroduzir resolveSplitPolicy.

// Percentual fixo de referral (5%)
const REFERRAL_PERCENTAGE = 0.05;

interface SplitRule {
  splitType: BankSplitType;
  percentage: number;
  targetAccountName?: SystemAccountName;
  targetAccountId?: string; // Para contas não-sistema (organizer, worker, etc)
}

class BankSplitEngineService {
  /**
   * Defaults hardcoded por contexto (backward compat até cutover PE-3+).
   *
   * DECISION-0048: bankPolicyService.resolveSplitPolicy foi REMOVIDO.
   * Fluxos novos (Camada 1 fixed-price-escrow e além) devem usar
   * economic_policy_engine + createTransactionWithExplicitSplitLines.
   * Esta função permanece apenas para event_ticket / ride_payment /
   * p2p_transfer / group_contribution / service_booking enquanto não
   * migrados.
   */
  private getSplitConfig(context: BankTransactionContext): SplitRule[] {
    switch (context) {
      case 'service_booking':
        // Service booking: 3% fee, 97% para worker/service provider
        return [
          { splitType: 'revenue_share', percentage: 0.97 }, // Worker/service provider
          { splitType: 'fee', percentage: 0.03, targetAccountName: 'fee' },
        ];

      case 'event_ticket':
        // Event ticket: organizer + fee + regional_fund + reserve
        // Organizer: 70%, Fee: 3%, Regional Fund: 10%, Reserve: 17%
        return [
          { splitType: 'revenue_share', percentage: 0.70 }, // Organizer
          { splitType: 'fee', percentage: 0.03, targetAccountName: 'fee' },
          { splitType: 'regional_fund', percentage: 0.10, targetAccountName: 'regional_fund' },
          { splitType: 'reserve', percentage: 0.17, targetAccountName: 'reserve' },
        ];

      case 'ride_payment':
        // Ride payment: 3% fee, 97% para driver
        return [
          { splitType: 'revenue_share', percentage: 0.97 }, // Driver
          { splitType: 'fee', percentage: 0.03, targetAccountName: 'fee' },
        ];

      case 'p2p_transfer':
      case 'group_contribution':
        // P2P e Group: 0% fee, 100% para destinatário
        return [
          { splitType: 'revenue_share', percentage: 1.0 },
        ];

      case 'deposit':
      case 'withdrawal':
        // Depósitos e saques não têm splits
        return [];

      default:
        throw new Error(`Unknown transaction context: ${context}`);
    }
  }

  /**
   * Calcula splits para uma transação
   * 
   * Ordem de aplicação:
   * 1. System fee (se aplicável)
   * 2. Referral split (se válido, sobre profit)
   * 3. User group allocation (sobre remainder após referral)
   * 4. Remainder → Regional Fund
   * 
   * @param tenantId - ID do tenant
   * @param context - Contexto da transação
   * @param totalAmountCents - Valor total em centavos (inteiro)
   * @param currency - Moeda
   * @param revenueShareAccountId - Conta para revenue share (organizer, worker, etc)
   * @param fromUserId - User ID para calcular referral e group allocation
   */
  async calculateSplits(
    tenantId: string,
    context: BankTransactionContext,
    totalAmountCents: number,
    currency: BankCurrency,
    revenueShareAccountId?: string, // Para organizer, worker, etc
    fromUserId?: string // Para calcular referral e group allocation
  ): Promise<BankSplitCalculation> {
    if (!Number.isInteger(totalAmountCents) || totalAmountCents < 0) {
      throw new Error('totalAmountCents deve ser inteiro ≥ 0');
    }
    const total = totalAmountCents;
    if (total === 0) {
      return { totalAmountCents: 0, splits: [] };
    }

    const config = this.getSplitConfig(context);
    const splits: Array<{
      splitType: BankSplitType;
      targetAccountId: string;
      amountCents: number;
      percentage: number;
      metadata?: Record<string, any>;
    }> = [];

    let profitAmountCents = total;

    // 1. Splits do contexto (fees + revenue)
    for (const rule of config) {
      const lineCents = Math.round(total * rule.percentage);
      let targetAccountId: string;

      if (rule.targetAccountName) {
        const systemAccount = await bankAccountService.getSystemAccount(
          tenantId,
          rule.targetAccountName,
          currency
        );
        if (!systemAccount) {
          throw new Error(`System account ${rule.targetAccountName} not found`);
        }
        targetAccountId = systemAccount.accountId;
      } else if (rule.targetAccountId) {
        targetAccountId = rule.targetAccountId;
      } else if (revenueShareAccountId) {
        targetAccountId = revenueShareAccountId;
      } else {
        throw new Error(`Target account not specified for split type ${rule.splitType}`);
      }

      if (rule.splitType === 'fee') {
        profitAmountCents -= lineCents;
      }

      if (lineCents > 0) {
        splits.push({
          splitType: rule.splitType,
          targetAccountId,
          amountCents: lineCents,
          percentage: rule.percentage,
          metadata: rule.splitType === 'revenue_share' && revenueShareAccountId ? { revenueShareAccountId } : undefined,
        });
      }
    }

    // 2. Referral sobre profit (centavos inteiros)
    //    DECISION-0139: o earning de indicação pertence ao ACTOR dono do código
    //    (owner_actor_id), NÃO ao CPF/user por reflexo. Destino = actor_wallet do owner.
    //    target_actor_id é resolvido pelo writer canônico a partir da conta destino
    //    (bank_accounts.actor_id da actor_wallet) — DECISION-0036. Sem alterar Bank Core.
    if (fromUserId && profitAmountCents > 0) {
      // 🔴 365 DIAS AQUI É PRESERVAÇÃO DE COMPORTAMENTO, NÃO RATIFICAÇÃO (2026-08-05).
      // Este motor é LEGADO CERCADO (zero chamadas vivas, medido). Antes, a janela de 1 ano vivia
      // DENTRO de `getActiveReferral` como `setFullYear(-1)`; ela saiu de lá porque Clayton decidiu
      // que o prazo é configurável no painel (`economic_policy_lines.eligibility_window_days`).
      // O motor legado não resolve policy, então não tem de onde ler o prazo — passa o valor que
      // reproduz o comportamento anterior, agora VISÍVEL em vez de escondido.
      // ⚠️ Este 365 é da mesma família do `REFERRAL_PERCENTAGE = 0.05` logo acima: default de
      // desenvolvedor NUNCA ratificado. O trilho canônico é a policy; aqui é só o legado não mudar
      // de comportamento enquanto não morre.
      const active = await getActiveReferral(tenantId, fromUserId, new Date(), 365);

      if (active) {
        const referralCents = Math.round(profitAmountCents * REFERRAL_PERCENTAGE);
        // actor_wallet do owner econômico (idempotente; cria se ausente).
        const referrerAccount = await bankAccountService.ensureActorWalletAccount(
          tenantId,
          active.referrerActorId,
          currency
        );

        if (referrerAccount && referralCents > 0) {
          splits.push({
            splitType: 'referral',
            targetAccountId: referrerAccount.accountId,
            amountCents: referralCents,
            percentage: REFERRAL_PERCENTAGE,
            metadata: {
              referrerActorId: active.referrerActorId,
              referrerUserId: active.referrerUserId,
              referredUserId: fromUserId,
              allocationType: 'referral',
            },
          });
          profitAmountCents -= referralCents;
        }
      }
    }

    // 3. Group allocation (percentuais 0–100 sobre profit restante)
    if (fromUserId && profitAmountCents > 0) {
      const allocations = await userGroupAllocationRepository.findByUserId(tenantId, fromUserId);

      if (allocations.length > 0) {
        let groupAllocationTotalCents = 0;

        for (const alloc of allocations) {
          const groupCents = Math.round(profitAmountCents * (alloc.percentage / 100));
          const groupAccount = await bankAccountService.getAccountByOwner(
            tenantId,
            alloc.groupId,
            'company',
            currency
          );

          if (groupAccount && groupCents > 0) {
            splits.push({
              splitType: 'revenue_share',
              targetAccountId: groupAccount.accountId,
              amountCents: groupCents,
              percentage: alloc.percentage / 100,
              metadata: { groupId: alloc.groupId, allocationType: 'user_group_allocation' },
            });
            groupAllocationTotalCents += groupCents;
          }
        }

        profitAmountCents -= groupAllocationTotalCents;
      }
    }

    // 4. Remanescente → regional_fund
    // Só dispara se há remanescente REAL após aplicar todos os splits anteriores.
    // Contextos com rules totalizando 100% (event_ticket: 70+3+10+17) já alocam tudo;
    // step 4 redundante criaria split duplo de regional_fund e quebraria invariante total=sumSplits.
    const currentSumCents = splits.reduce((s, x) => s + x.amountCents, 0);
    const remainderToAllocateCents = total - currentSumCents;
    if (remainderToAllocateCents > 0) {
      const regionalFundAccount = await bankAccountService.getSystemAccount(
        tenantId,
        'regional_fund',
        currency
      );

      if (regionalFundAccount) {
        const remainderFraction = total > 0 ? remainderToAllocateCents / total : 0;
        splits.push({
          splitType: 'regional_fund',
          targetAccountId: regionalFundAccount.accountId,
          amountCents: remainderToAllocateCents,
          percentage: remainderFraction,
          metadata: { allocationType: 'remainder' },
        });
      }
    }

    const sumCents = splits.reduce((s, x) => s + x.amountCents, 0);
    let driftCents = total - sumCents;
    if (driftCents !== 0) {
      if (splits.length === 0) {
        throw new Error('Split engine: total > 0 mas nenhuma linha de split gerada');
      }
      const revenueShareIndex = splits.findIndex((s) => s.splitType === 'revenue_share');
      const idx = revenueShareIndex >= 0 ? revenueShareIndex : 0;
      splits[idx].amountCents += driftCents;
      if (splits[idx].amountCents <= 0) {
        throw new Error('Split engine: ajuste de arredondamento produziu linha não positiva');
      }
      driftCents = total - splits.reduce((s, x) => s + x.amountCents, 0);
    }

    if (splits.some((s) => s.amountCents <= 0)) {
      throw new Error('Split engine: linha com amountCents não positivo após alocação');
    }

    return {
      totalAmountCents: total,
      splits: splits.map((s) => ({
        splitType: s.splitType,
        targetAccountId: s.targetAccountId,
        amountCents: s.amountCents,
        percentage: s.percentage,
        metadata: s.metadata,
      })),
      remainderCents: driftCents !== 0 ? Math.abs(driftCents) : undefined,
    };
  }

  /**
   * Valida que a soma dos splits (centavos) é exatamente o total canónico.
   */
  validateSplitCalculation(calculation: BankSplitCalculation): boolean {
    const sum = calculation.splits.reduce((acc, split) => acc + split.amountCents, 0);
    return sum === calculation.totalAmountCents;
  }
}

export const bankSplitEngineService = new BankSplitEngineService();








