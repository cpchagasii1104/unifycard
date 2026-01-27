// backend/src/modules/bank/bank-split-engine.service.ts
// SPRINT 2: TRANSACTIONS + SPLIT ENGINE
// CONTINUOUS PRODUCTION: Extended with referral + group allocation
// Engine de splits do Unify Bank

import { bankAccountService } from './bank-account.service';
import { getActiveReferral } from '@core/referral/referral-helper.service';
import { userGroupAllocationRepository } from '@core/user-group-allocation/user-group-allocation.repository';
import { bankPolicyService, type SplitPolicyRule, type SplitPolicyMetadata } from './bank-policy.service';
import type {
  BankTransactionContext,
  BankSplitCalculation,
  BankSplitType,
  SystemAccountName,
} from './bank-split.types';
import type { BankCurrency } from './bank-account.types';

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
   * Obtém configuração de splits para um contexto
   * Usa Policy Registry se disponível, senão usa defaults hardcoded (backward compatible)
   * 
   * @param tenantId - ID do tenant
   * @param context - Contexto da transação
   * @param metadata - Metadata opcional para resolução hierárquica de policies
   */
  private async getSplitConfig(
    tenantId: string,
    context: BankTransactionContext,
    metadata?: SplitPolicyMetadata
  ): Promise<SplitRule[]> {
    // Tentar buscar do Policy Registry (com resolução hierárquica se metadata fornecido)
    const policy = await bankPolicyService.resolveSplitPolicy(tenantId, context, metadata);
    
    if (policy && policy.splits) {
      // Converter policy rules para SplitRule
      return policy.splits.map((rule: SplitPolicyRule) => ({
        splitType: rule.splitType,
        percentage: rule.percentage,
        targetAccountName: rule.targetAccountName,
        targetAccountId: rule.targetAccountId,
      }));
    }

    // Fallback: defaults hardcoded (backward compatible)
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
   * @param totalAmount - Valor total da transação
   * @param currency - Moeda
   * @param revenueShareAccountId - Conta para revenue share (organizer, worker, etc)
   * @param fromUserId - User ID para calcular referral e group allocation
   * @param metadata - Metadata opcional para resolução hierárquica de split policies
   */
  async calculateSplits(
    tenantId: string,
    context: BankTransactionContext,
    totalAmount: number,
    currency: BankCurrency,
    revenueShareAccountId?: string, // Para organizer, worker, etc
    fromUserId?: string, // Para calcular referral e group allocation
    metadata?: SplitPolicyMetadata // Metadata para resolução hierárquica de policies
  ): Promise<BankSplitCalculation> {
    const config = await this.getSplitConfig(tenantId, context, metadata);
    const splits: Array<{
      splitType: BankSplitType;
      targetAccountId: string;
      amount: number;
      percentage: number;
      metadata?: Record<string, any>;
    }> = [];

    let totalCalculated = 0;
    let profitAmount = totalAmount; // Profit = total após deduzir fees

    // 1. Aplicar splits padrão do contexto (fees primeiro)
    for (const rule of config) {
      const amount = totalAmount * rule.percentage;
      let targetAccountId: string;

      if (rule.targetAccountName) {
        // Conta do sistema
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
        // Conta específica fornecida
        targetAccountId = rule.targetAccountId;
      } else if (revenueShareAccountId) {
        // Revenue share (organizer, worker, etc)
        targetAccountId = revenueShareAccountId;
      } else {
        throw new Error(`Target account not specified for split type ${rule.splitType}`);
      }

      // Deduzir fees do profit
      if (rule.splitType === 'fee') {
        profitAmount -= amount;
      }

      splits.push({
        splitType: rule.splitType,
        targetAccountId,
        amount: Math.round(amount * 100) / 100,
        percentage: rule.percentage,
        metadata: rule.splitType === 'revenue_share' && revenueShareAccountId ? { revenueShareAccountId } : undefined,
      });

      totalCalculated += amount;
    }

    // 2. Aplicar referral split (se válido, sobre profit)
    if (fromUserId && profitAmount > 0) {
      const referrerUserId = await getActiveReferral(tenantId, fromUserId);
      
      if (referrerUserId) {
        // Calcular split de referral sobre profit
        const referralAmount = profitAmount * REFERRAL_PERCENTAGE;
        
        // Resolver conta do referrer
        const referrerAccount = await bankAccountService.getAccountByOwner(
          tenantId,
          referrerUserId,
          'user',
          currency
        );
        
        if (referrerAccount) {
          splits.push({
            splitType: 'referral',
            targetAccountId: referrerAccount.accountId,
            amount: Math.round(referralAmount * 100) / 100,
            percentage: REFERRAL_PERCENTAGE,
            metadata: { referrerUserId, referredUserId: fromUserId, allocationType: 'referral' },
          });
          
          totalCalculated += referralAmount;
          profitAmount -= referralAmount; // Deduzir do profit restante
        }
      }
    }

    // 3. Aplicar group allocation (sobre remainder após referral)
    if (fromUserId && profitAmount > 0) {
      const allocations = await userGroupAllocationRepository.findByUserId(tenantId, fromUserId);
      
      if (allocations.length > 0) {
        let groupAllocationTotal = 0;
        
        for (const alloc of allocations) {
          const groupAmount = profitAmount * (alloc.percentage / 100);
          
          // Resolver conta do grupo
          const groupAccount = await bankAccountService.getAccountByOwner(
            tenantId,
            alloc.groupId,
            'company', // Grupos usam ownerType 'company'
            currency
          );
          
          if (groupAccount) {
            splits.push({
              splitType: 'revenue_share', // Groups recebem como revenue_share
              targetAccountId: groupAccount.accountId,
              amount: Math.round(groupAmount * 100) / 100,
              percentage: alloc.percentage / 100,
              metadata: { groupId: alloc.groupId, allocationType: 'user_group_allocation' },
            });
            
            totalCalculated += groupAmount;
            groupAllocationTotal += groupAmount;
          }
        }
        
        profitAmount -= groupAllocationTotal;
      }
    }

    // 4. Enviar remainder para Regional Fund
    if (profitAmount > 0.01) {
      const regionalFundAccount = await bankAccountService.getSystemAccount(
        tenantId,
        'regional_fund',
        currency
      );
      
      if (regionalFundAccount) {
        const remainderPercentage = (profitAmount / totalAmount) * 100;
        splits.push({
          splitType: 'regional_fund',
          targetAccountId: regionalFundAccount.accountId,
          amount: Math.round(profitAmount * 100) / 100,
          percentage: remainderPercentage / 100,
          metadata: { allocationType: 'remainder' },
        });
        
        totalCalculated += profitAmount;
      }
    }

    // Ajustar diferença por arredondamento no primeiro split (revenue_share se existir)
    const difference = totalAmount - totalCalculated;
    if (Math.abs(difference) > 0.01) {
      const revenueShareIndex = splits.findIndex((s) => s.splitType === 'revenue_share');
      if (revenueShareIndex >= 0) {
        splits[revenueShareIndex].amount += difference;
        splits[revenueShareIndex].amount = Math.round(splits[revenueShareIndex].amount * 100) / 100;
      } else {
        // Fallback: ajustar o primeiro split
        splits[0].amount += difference;
        splits[0].amount = Math.round(splits[0].amount * 100) / 100;
      }
    }

    return {
      totalAmount,
      splits,
      remainder: Math.abs(difference) > 0.01 ? difference : undefined,
    };
  }

  /**
   * Valida que a soma dos splits é igual ao total
   */
  validateSplitCalculation(calculation: BankSplitCalculation): boolean {
    const total = calculation.splits.reduce((sum, split) => sum + split.amount, 0);
    const difference = Math.abs(calculation.totalAmount - total);
    return difference < 0.01; // Tolerância de 1 centavo
  }
}

export const bankSplitEngineService = new BankSplitEngineService();







