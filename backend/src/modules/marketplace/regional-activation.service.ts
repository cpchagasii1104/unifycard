// backend/src/modules/marketplace/regional-activation.service.ts
// FASE X — Bloco 2: Regional Activation Rules (isHubSuggested, isIndustryOnboardingEnabled, getUnlockedIncentive)

import type { ActionType } from './regional-activation.repository';
import { regionalActivationRepository } from './regional-activation.repository';
import { regionalImpactService } from './regional-impact.service';

export interface RegionInput {
  country: string;
  state: string;
  city: string;
}

/** Retorno de incentivo desbloqueado para compatibilidade com if (!unlockedIncentive) */
export type UnlockedIncentiveResult = { unlocked: true } | null;

function meetsThresholds(
  snapshotVolumeCents: number,
  snapshotTransactions: number,
  rule: { threshold_volume_cents: string | null; threshold_transactions: number | null }
): boolean {
  const vol = rule.threshold_volume_cents != null ? Number(rule.threshold_volume_cents) : null;
  const tx = rule.threshold_transactions;
  if (vol != null && snapshotVolumeCents < vol) return false;
  if (tx != null && snapshotTransactions < tx) return false;
  return true;
}

class RegionalActivationService {
  async isHubSuggested(tenantId: string, region: RegionInput): Promise<boolean> {
    const snapshot = await regionalImpactService.getLatestRegionalImpact(tenantId, region);
    const rule = await regionalActivationRepository.getRuleByAction(tenantId, region, 'suggest_hub');
    if (!rule) return false;
    if (!snapshot) return false;
    const volumeCents = Math.round(snapshot.totalTransactionsAmount * 100);
    const transactions = snapshot.totalOrdersCount;
    return meetsThresholds(volumeCents, transactions, rule);
  }

  async isIndustryOnboardingEnabled(tenantId: string, region: RegionInput): Promise<boolean> {
    const snapshot = await regionalImpactService.getLatestRegionalImpact(tenantId, region);
    const rule = await regionalActivationRepository.getRuleByAction(tenantId, region, 'enable_industry_onboarding');
    if (!rule) return false;
    if (!snapshot) return false;
    const volumeCents = Math.round(snapshot.totalTransactionsAmount * 100);
    const transactions = snapshot.totalOrdersCount;
    return meetsThresholds(volumeCents, transactions, rule);
  }

  async getUnlockedIncentive(tenantId: string, region: RegionInput): Promise<UnlockedIncentiveResult> {
    const snapshot = await regionalImpactService.getLatestRegionalImpact(tenantId, region);
    const rule = await regionalActivationRepository.getRuleByAction(tenantId, region, 'unlock_incentive');
    if (!rule) return null;
    if (!snapshot) return null;
    const volumeCents = Math.round(snapshot.totalTransactionsAmount * 100);
    const transactions = snapshot.totalOrdersCount;
    return meetsThresholds(volumeCents, transactions, rule) ? { unlocked: true } : null;
  }
}

export const regionalActivationService = new RegionalActivationService();