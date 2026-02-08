// backend/src/modules/marketplace/event-settlement.repository.ts
// SPRINT 84: EVENT SETTLEMENT + BILHETERIA FINANCEIRA

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  EventSettlement,
  CreateEventSettlementInput,
} from './event-settlement.types';

interface EventSettlementRow {
  id: string;
  tenant_id: string;
  event_id: string;
  gross_revenue: number;
  commissions_amount: number;
  regional_fee_amount: number;
  net_amount: number;
  currency: string;
  status: string;
  settlement_id: string | null;
  settledAt: Date | null;
  settled_by_actor_id: string | null;
  settled_by_user_id: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

class EventSettlementRepository {
  private toEventSettlement(row: EventSettlementRow): EventSettlement {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      eventId: row.event_id,
      grossRevenue: Number(row.gross_revenue),
      commissionsAmount: Number(row.commissions_amount),
      regionalFeeAmount: Number(row.regional_fee_amount),
      netAmount: Number(row.net_amount),
      currency: row.currency,
      status: row.status as any,
      settlementId: row.settlement_id,
      settledAt: row.settledAt,
      settledByActorId: row.settled_by_actor_id,
      settledByUserId: row.settled_by_user_id,
      metadata: row.metadata || {},
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async createSettlement(
    tenantId: string,
    input: CreateEventSettlementInput,
    createdByActorId: string,
    createdByUserId?: string
  ): Promise<EventSettlement> {
    const commissionsAmount = input.commissionsAmount || 0;
    const regionalFeeAmount = input.regionalFeeAmount || 0;
    const netAmount = input.grossRevenue - commissionsAmount - regionalFeeAmount;

    const row = await runQueryWithTenant<EventSettlementRow>(
      tenantId,
      `
      INSERT INTO event_settlements (
        tenant_id, event_id, gross_revenue, commissions_amount,
        regional_fee_amount, net_amount, currency, status, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, tenant_id, event_id, gross_revenue, commissions_amount,
                regional_fee_amount, net_amount, currency, status, settlement_id,
                settledAt, settled_by_actor_id, settled_by_user_id,
                metadata, createdAt, updatedAt
      `,
      [
        tenantId,
        input.eventId,
        input.grossRevenue,
        commissionsAmount,
        regionalFeeAmount,
        netAmount,
        'BRL',
        'PENDING',
        JSON.stringify(input.metadata || {}),
      ]
    );

    return this.toEventSettlement(row);
  }

  async getSettlementById(
    tenantId: string,
    settlementId: string
  ): Promise<EventSettlement | null> {
    const rows = await runQueriesWithTenant<EventSettlementRow>(
      tenantId,
      `
      SELECT id, tenant_id, event_id, gross_revenue, commissions_amount,
             regional_fee_amount, net_amount, currency, status, settlement_id,
             settledAt, settled_by_actor_id, settled_by_user_id,
             metadata, createdAt, updatedAt
      FROM event_settlements
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, settlementId]
    );

    if (rows.length === 0) {
      return null;
    }

    return this.toEventSettlement(rows[0]);
  }

  async getSettlementByEvent(
    tenantId: string,
    eventId: string
  ): Promise<EventSettlement | null> {
    const rows = await runQueriesWithTenant<EventSettlementRow>(
      tenantId,
      `
      SELECT id, tenant_id, event_id, gross_revenue, commissions_amount,
             regional_fee_amount, net_amount, currency, status, settlement_id,
             settledAt, settled_by_actor_id, settled_by_user_id,
             metadata, createdAt, updatedAt
      FROM event_settlements
      WHERE tenant_id = $1 AND event_id = $2
      ORDER BY createdAt DESC
      LIMIT 1
      `,
      [tenantId, eventId]
    );

    if (rows.length === 0) {
      return null;
    }

    return this.toEventSettlement(rows[0]);
  }

  async markAsSettled(
    tenantId: string,
    settlementId: string,
    settlementCoreId: string | null,
    settledByActorId: string,
    settledByUserId: string | null
  ): Promise<EventSettlement> {
    const row = await runQueryWithTenant<EventSettlementRow>(
      tenantId,
      `
      UPDATE event_settlements
      SET status = 'SETTLED',
          settlement_id = $3,
          settledAt = NOW(),
          settled_by_actor_id = $4,
          settled_by_user_id = $5
      WHERE tenant_id = $1 AND id = $2
      RETURNING id, tenant_id, event_id, gross_revenue, commissions_amount,
                regional_fee_amount, net_amount, currency, status, settlement_id,
                settledAt, settled_by_actor_id, settled_by_user_id,
                metadata, createdAt, updatedAt
      `,
      [tenantId, settlementId, settlementCoreId, settledByActorId, settledByUserId]
    );

    return this.toEventSettlement(row);
  }
}

export const eventSettlementRepository = new EventSettlementRepository();



