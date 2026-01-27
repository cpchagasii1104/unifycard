// backend/src/modules/payments/pix-webhook.repository.ts
// SPRINT 85: PIX INTEGRATION

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { PixWebhookEvent } from './pix.types';

interface PixWebhookEventRow {
  id: string;
  tenant_id: string;
  provider: string;
  provider_event_id: string;
  pix_charge_id: string | null;
  status: string;
  raw_payload: any;
  received_at: Date;
  processed_at: Date | null;
  error_message: string | null;
  metadata: any;
  created_at: Date;
}

class PixWebhookEventRepository {
  private toWebhookEvent(row: PixWebhookEventRow): PixWebhookEvent {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      provider: row.provider,
      providerEventId: row.provider_event_id,
      pixChargeId: row.pix_charge_id,
      status: row.status as any,
      rawPayload: row.raw_payload || {},
      receivedAt: row.received_at,
      processedAt: row.processed_at,
      errorMessage: row.error_message,
      metadata: row.metadata || {},
      createdAt: row.created_at,
    };
  }

  async createEvent(
    tenantId: string,
    provider: string,
    providerEventId: string,
    rawPayload: Record<string, any>,
    pixChargeId?: string
  ): Promise<PixWebhookEvent> {
    const row = await runQueryWithTenant<PixWebhookEventRow>(
      tenantId,
      `
      INSERT INTO pix_webhook_events (
        tenant_id, provider, provider_event_id, pix_charge_id,
        status, raw_payload, metadata
      )
      VALUES ($1, $2, $3, $4, 'RECEIVED', $5::jsonb, '{}'::jsonb)
      ON CONFLICT (tenant_id, provider, provider_event_id) DO NOTHING
      RETURNING id, tenant_id, provider, provider_event_id, pix_charge_id,
                status, raw_payload, received_at, processed_at, error_message,
                metadata, created_at
      `,
      [
        tenantId,
        provider,
        providerEventId,
        pixChargeId || null,
        JSON.stringify(rawPayload),
      ]
    );

    if (!row) {
      // Evento duplicado (idempotência)
      const existing = await this.getEventByProviderEventId(tenantId, provider, providerEventId);
      if (existing) {
        return existing;
      }
      throw new Error('Erro ao criar webhook event');
    }

    return this.toWebhookEvent(row);
  }

  async getEventByProviderEventId(
    tenantId: string,
    provider: string,
    providerEventId: string
  ): Promise<PixWebhookEvent | null> {
    const row = await runQueryWithTenant<PixWebhookEventRow>(
      tenantId,
      `
      SELECT id, tenant_id, provider, provider_event_id, pix_charge_id,
             status, raw_payload, received_at, processed_at, error_message,
             metadata, created_at
      FROM pix_webhook_events
      WHERE tenant_id = $1 AND provider = $2 AND provider_event_id = $3
      `,
      [tenantId, provider, providerEventId]
    );

    if (!row) {
      return null;
    }

    return this.toWebhookEvent(row);
  }

  async markAsProcessed(
    tenantId: string,
    eventId: string,
    pixChargeId?: string
  ): Promise<PixWebhookEvent> {
    const updates: string[] = ['status = $3', 'processed_at = NOW()'];
    const params: any[] = [tenantId, eventId, 'PROCESSED'];
    
    if (pixChargeId) {
      updates.push('pix_charge_id = $4');
      params.push(pixChargeId);
    }

    const row = await runQueryWithTenant<PixWebhookEventRow>(
      tenantId,
      `
      UPDATE pix_webhook_events
      SET ${updates.join(', ')}
      WHERE tenant_id = $1 AND id = $2
      RETURNING id, tenant_id, provider, provider_event_id, pix_charge_id,
                status, raw_payload, received_at, processed_at, error_message,
                metadata, created_at
      `,
      params
    );

    return this.toWebhookEvent(row);
  }

  async markAsFailed(
    tenantId: string,
    eventId: string,
    errorMessage: string
  ): Promise<PixWebhookEvent> {
    const row = await runQueryWithTenant<PixWebhookEventRow>(
      tenantId,
      `
      UPDATE pix_webhook_events
      SET status = 'FAILED', error_message = $3, processed_at = NOW()
      WHERE tenant_id = $1 AND id = $2
      RETURNING id, tenant_id, provider, provider_event_id, pix_charge_id,
                status, raw_payload, received_at, processed_at, error_message,
                metadata, created_at
      `,
      [tenantId, eventId, errorMessage]
    );

    return this.toWebhookEvent(row);
  }

  async markAsDuplicate(
    tenantId: string,
    eventId: string
  ): Promise<PixWebhookEvent> {
    const row = await runQueryWithTenant<PixWebhookEventRow>(
      tenantId,
      `
      UPDATE pix_webhook_events
      SET status = 'DUPLICATE', processed_at = NOW()
      WHERE tenant_id = $1 AND id = $2
      RETURNING id, tenant_id, provider, provider_event_id, pix_charge_id,
                status, raw_payload, received_at, processed_at, error_message,
                metadata, created_at
      `,
      [tenantId, eventId]
    );

    return this.toWebhookEvent(row);
  }
}

export const pixWebhookEventRepository = new PixWebhookEventRepository();





