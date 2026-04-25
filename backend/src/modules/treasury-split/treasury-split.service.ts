// Treasury Split Service — calcula e executa split pós-settlement.
// Não escreve diretamente em bank_transactions nem bank_ledger; usa bankTransactionService e repositórios.

import { v4 as uuidv4 } from 'uuid';
import type { TreasurySplitConfig } from './treasury-split-config.repository';
import {
  getSplitConfig,
  createDefaultSplitConfig,
  hasExecutionForSettlement,
  hasExecutionForIdempotencyKey,
  recordSplitExecution,
} from './treasury-split-config.repository';
import { listTreasuryAccounts } from '@modules/treasury/treasury-account-repository';
import { createProcessedDistribution } from '@modules/treasury/treasury-distribution-repository';
import { bankAccountService } from '@modules/bank/bank-account.service';
import { bankTransactionService } from '@modules/bank/bank-transaction.service';
import { buildSystemAuthorship } from '@modules/bank/financial-authorship.helper';
import type { BankCurrency } from '@modules/bank/bank-account.types';

export interface TreasurySplitResult {
  regionalFundCents: number;
  communityFundCents: number;
  systemReserveCents: number;
  governancePoolCents: number;
  sellerCents: number;
  totalCents: number;
}

const TREASURY_TYPES = ['regional_fund', 'community_fund', 'system_reserve', 'governance_pool'] as const;

/**
 * Calcula os valores em centavos por destino. Soma = amountCents; residual vai para seller.
 */
export function computeSplit(amountCents: number, config: TreasurySplitConfig): TreasurySplitResult {
  const regionalFundCents = Math.floor((amountCents * config.pctRegional) / 100);
  const communityFundCents = Math.floor((amountCents * config.pctCommunity) / 100);
  const systemReserveCents = Math.floor((amountCents * config.pctSystemReserve) / 100);
  const governancePoolCents = Math.floor((amountCents * config.pctGovernance) / 100);
  const allocated = regionalFundCents + communityFundCents + systemReserveCents + governancePoolCents;
  const sellerCents = amountCents - allocated;
  return {
    regionalFundCents,
    communityFundCents,
    systemReserveCents,
    governancePoolCents,
    sellerCents,
    totalCents: amountCents,
  };
}

export interface ExecuteSplitParams {
  settlementId: string;
  tenantId: string;
  amountCents: number;
  currency: string;
  idempotencyKey?: string | null;
}

/**
 * Executa o split: transfere do bank_settlement para as contas de tesouraria; registra execução e distribuições (auditoria).
 * Idempotente por settlementId e por (tenantId, idempotencyKey).
 */
export async function executeSplit(params: ExecuteSplitParams): Promise<void> {
  const { settlementId, tenantId, amountCents, currency, idempotencyKey } = params;

  if (await hasExecutionForSettlement(settlementId)) {
    return;
  }
  if (idempotencyKey && (await hasExecutionForIdempotencyKey(tenantId, idempotencyKey))) {
    return;
  }

  let config = await getSplitConfig(tenantId);
  if (!config) {
    config = await createDefaultSplitConfig(tenantId);
  }

  const result = computeSplit(amountCents, config);

  await bankAccountService.ensurePlatformAccounts(tenantId, currency as BankCurrency);
  const sourceAccount = await bankAccountService.getPlatformLifecycleAccount(
    tenantId,
    'bank_settlement',
    currency as BankCurrency
  );
  if (!sourceAccount) {
    throw new Error('Treasury split: bank_settlement account not found');
  }

  const treasuryAccounts = await listTreasuryAccounts(tenantId);
  const byType = new Map<string, { id: string; accountId: string }>();
  for (const ta of treasuryAccounts) {
    byType.set(ta.treasuryType, { id: ta.id, accountId: ta.accountId });
  }

  const authorship = buildSystemAuthorship({ actingForAccountId: sourceAccount.accountId });
  const currencyTyped = currency as BankCurrency;

  if (result.regionalFundCents > 0) {
    const dest = byType.get('regional_fund');
    if (dest) {
      await bankTransactionService.transfer(tenantId, {
        eventId: uuidv4(),
        fromAccountId: sourceAccount.accountId,
        toAccountId: dest.accountId,
        amountCents: result.regionalFundCents,
        currency: currencyTyped,
        transactionType: 'transfer',
        description: `Treasury split (regional_fund): settlement ${settlementId}`,
        referenceType: 'treasury_split_leg',
        referenceId: `${settlementId}_regional_fund`,
        treasurySource: 'treasury:distribution',
        authorship,
        concept_id: 'treasury-regional-fund-distribution',
      });
      await createProcessedDistribution(tenantId, {
        treasuryAccountId: dest.id,
        proposalId: null,
        referenceId: settlementId,
        amountCents: result.regionalFundCents,
        distributionType: 'settlement_split_regional',
      });
    }
  }

  if (result.communityFundCents > 0) {
    const dest = byType.get('community_fund');
    if (dest) {
      await bankTransactionService.transfer(tenantId, {
        eventId: uuidv4(),
        fromAccountId: sourceAccount.accountId,
        toAccountId: dest.accountId,
        amountCents: result.communityFundCents,
        currency: currencyTyped,
        transactionType: 'transfer',
        description: `Treasury split (community_fund): settlement ${settlementId}`,
        referenceType: 'treasury_split_leg',
        referenceId: `${settlementId}_community_fund`,
        treasurySource: 'treasury:distribution',
        authorship,
        concept_id: 'treasury-community-fund-distribution',
      });
      await createProcessedDistribution(tenantId, {
        treasuryAccountId: dest.id,
        proposalId: null,
        referenceId: settlementId,
        amountCents: result.communityFundCents,
        distributionType: 'settlement_split_community',
      });
    }
  }

  if (result.systemReserveCents > 0) {
    const dest = byType.get('system_reserve');
    if (dest) {
      await bankTransactionService.transfer(tenantId, {
        eventId: uuidv4(),
        fromAccountId: sourceAccount.accountId,
        toAccountId: dest.accountId,
        amountCents: result.systemReserveCents,
        currency: currencyTyped,
        transactionType: 'transfer',
        description: `Treasury split (system_reserve): settlement ${settlementId}`,
        referenceType: 'treasury_split_leg',
        referenceId: `${settlementId}_system_reserve`,
        treasurySource: 'treasury:distribution',
        authorship,
      });
      await createProcessedDistribution(tenantId, {
        treasuryAccountId: dest.id,
        proposalId: null,
        referenceId: settlementId,
        amountCents: result.systemReserveCents,
        distributionType: 'settlement_split_system_reserve',
      });
    }
  }

  if (result.governancePoolCents > 0) {
    const dest = byType.get('governance_pool');
    if (dest) {
      await bankTransactionService.transfer(tenantId, {
        eventId: uuidv4(),
        fromAccountId: sourceAccount.accountId,
        toAccountId: dest.accountId,
        amountCents: result.governancePoolCents,
        currency: currencyTyped,
        transactionType: 'transfer',
        description: `Treasury split (governance_pool): settlement ${settlementId}`,
        referenceType: 'treasury_split_leg',
        referenceId: `${settlementId}_governance_pool`,
        treasurySource: 'treasury:distribution',
        authorship,
      });
      await createProcessedDistribution(tenantId, {
        treasuryAccountId: dest.id,
        proposalId: null,
        referenceId: settlementId,
        amountCents: result.governancePoolCents,
        distributionType: 'settlement_split_governance',
      });
    }
  }

  const splitResult = {
    regionalFundCents: result.regionalFundCents,
    communityFundCents: result.communityFundCents,
    systemReserveCents: result.systemReserveCents,
    governancePoolCents: result.governancePoolCents,
    sellerCents: result.sellerCents,
    totalCents: result.totalCents,
  };

  await recordSplitExecution(tenantId, settlementId, splitResult, idempotencyKey ?? undefined);

  console.log('TREASURY_SPLIT_EXECUTED', {
    settlementId,
    tenantId,
    ...splitResult,
  });
}