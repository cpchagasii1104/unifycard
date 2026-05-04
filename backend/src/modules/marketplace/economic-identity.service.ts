// backend/src/modules/marketplace/economic-identity.service.ts
// FASE X — Bloco 1: Economic Identity (serviço real, backing em DB)

import type { EconomicIdentity } from '@contracts/marketplace/EconomicIdentity.contract';
import {
  economicIdentityRepository,
  type EconomicIdentityRow,
  type CreateIdentityInput,
  type AppendEventInput,
} from './economic-identity.repository';

function trustScoreBpsToLevel(bps: number): EconomicIdentity['trustLevel'] {
  if (bps >= 8334) return 'L5';
  if (bps >= 6667) return 'L4';
  if (bps >= 5001) return 'L3';
  if (bps >= 3334) return 'L2';
  if (bps >= 1667) return 'L1';
  return 'L0';
}

function rowToEconomicIdentity(row: EconomicIdentityRow): EconomicIdentity {
  return {
    economicIdentityId: row.id,
    actorType: row.actor_type as EconomicIdentity['actorType'],
    actorId: row.actor_id,
    trustLevel: trustScoreBpsToLevel(row.trust_score_bps),
    verifiedAssets: {
      documentsVerified: false,
      bankAccountVerified: false,
      companyVerified: false,
    },
    limits: {
      maxInvoiceAmount: 0,
      maxMonthlyVolume: 0,
    },
    status: row.status as EconomicIdentity['status'],
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

export interface CreateEconomicIdentityInput {
  actorId: string;
  actorType: 'user' | 'store' | 'hub' | 'industry' | 'service_provider';
  verified_assets?: {
    documents_verified?: boolean;
    bank_account_verified?: boolean;
    company_verified?: boolean;
  };
}

class EconomicIdentityService {
  async createEconomicIdentity(
    tenantId: string,
    input: CreateEconomicIdentityInput
  ): Promise<EconomicIdentity> {
    const row = await economicIdentityRepository.createIdentity(tenantId, input.actorId, {
      actorType: input.actorType,
    });
    return rowToEconomicIdentity(row);
  }

  async getEconomicIdentity(
    tenantId: string,
    actorId: string
  ): Promise<EconomicIdentity | null> {
    const row = await economicIdentityRepository.getByActorId(tenantId, actorId);
    if (!row) return null;
    return rowToEconomicIdentity(row);
  }

  async recordEconomicEvent(
    tenantId: string,
    actorId: string,
    event: AppendEventInput
  ): Promise<void> {
    await economicIdentityRepository.appendEvent(tenantId, actorId, event);
  }

  async recalculateTrustScore(tenantId: string, actorId: string): Promise<EconomicIdentity | null> {
    const identity = await economicIdentityRepository.getByActorId(tenantId, actorId);
    if (!identity) return null;
    const events = await economicIdentityRepository.listEvents(tenantId, actorId);
    const sum = events.reduce((acc, e) => acc + e.value_delta, 0);
    const trustScoreBps = Math.max(0, Math.min(10000, sum));
    await economicIdentityRepository.updateTrustScoreBps(tenantId, actorId, trustScoreBps);
    const updated = await economicIdentityRepository.getByActorId(tenantId, actorId);
    return updated ? rowToEconomicIdentity(updated) : null;
  }
}

export const economicIdentityService = new EconomicIdentityService();