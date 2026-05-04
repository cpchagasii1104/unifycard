// backend/src/modules/marketplace/regional-activation-events.service.ts
// FASE X — Bloco 2: Regional Activation Events (getRegionalActivationHistory)

import type { ActivationEvent } from '@contracts/marketplace/ActivationEvent.contract';
import type { RegionalActivationEventRow } from './regional-activation-events.repository';
import { regionalActivationEventsRepository } from './regional-activation-events.repository';

export interface RegionInput {
  country: string;
  state: string;
  city: string;
}

function rowToActivationEvent(row: RegionalActivationEventRow): ActivationEvent {
  const metadata = row.metadata as Record<string, unknown> | null | undefined;
  return {
    activationId: row.id,
    ruleId: (metadata?.ruleId as string) ?? '',
    region: { country: row.country, state: row.state, city: row.city },
    snapshotId: row.snapshot_id ?? '',
    actionType: row.action_type as ActivationEvent['actionType'],
    actionPayload: metadata?.actionPayload as ActivationEvent['actionPayload'],
    status: 'triggered',
    createdAt: row.triggered_at instanceof Date ? row.triggered_at.toISOString() : String(row.triggered_at),
  };
}

class RegionalActivationEventsService {
  async getRegionalActivationHistory(tenantId: string, region: RegionInput): Promise<ActivationEvent[]> {
    const rows = await regionalActivationEventsRepository.listByRegion(tenantId, region);
    return rows.map(rowToActivationEvent);
  }

  async recordActivation(
    tenantId: string,
    input: {
      country: string;
      state: string;
      city: string;
      actionType: 'suggest_hub' | 'enable_industry_onboarding' | 'unlock_incentive';
      snapshotId?: string | null;
      metadata?: Record<string, unknown> | null;
    }
  ): Promise<ActivationEvent> {
    const row = await regionalActivationEventsRepository.recordActivation(tenantId, input);
    return rowToActivationEvent(row);
  }
}

export const regionalActivationEventsService = new RegionalActivationEventsService();