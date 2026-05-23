// backend/src/modules/payments/pix.repository.ts
// SPRINT 85: PIX INTEGRATION

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { PixCharge, CreatePixChargeInput } from './pix.types';

interface PixChargeRow {
  id: string;
  tenant_id: string;
  payment_intent_id: string;
  provider: string;
  provider_charge_id: string;
  amount: string; // DB column; map to amountCents in TS
  currency: string;
  status: string;
  expires_at: Date;
  paid_at: Date | null;
  payload_snapshot: any;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

class PixChargeRepository {
  private toPixCharge(row: PixChargeRow): PixCharge {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      paymentIntentId: row.payment_intent_id,
      provider: row.provider,
      providerChargeId: row.provider_charge_id,
      amountCents: typeof row.amount === 'number' ? row.amount : parseFloat(String(row.amount)),
      currency: row.currency,
      status: row.status as any,
      expiresAt: row.expires_at,
      paidAt: row.paid_at,
      payloadSnapshot: row.payload_snapshot || {},
      metadata: row.metadata || {},
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  async createCharge(
    tenantId: string,
    input: CreatePixChargeInput,
    provider: string,
    providerChargeId: string,
    payloadSnapshot: Record<string, any>
  ): Promise<PixCharge> {
    const row = await runQueryWithTenant<PixChargeRow>(
      tenantId,
      `
      INSERT INTO pix_charges (
        tenant_id, payment_intent_id, provider, provider_charge_id,
        amount, currency, status, expires_at, payload_snapshot, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'CREATED', $7, $8::jsonb, $9::jsonb)
      RETURNING id, tenant_id, payment_intent_id, provider, provider_charge_id,
                amount, currency, status, expires_at, paid_at,
                payload_snapshot, metadata, created_at, updated_at
      `,
      [
        tenantId,
        input.paymentIntentId,
        provider,
        providerChargeId,
        input.amountCents,
        input.currency || 'BRL',
        input.expiresInMinutes
          ? new Date(Date.now() + input.expiresInMinutes * 60 * 1000)
          : new Date(Date.now() + 30 * 60 * 1000), // 30 minutos default
        JSON.stringify(payloadSnapshot),
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Falha ao criar PIX charge');
    }
    return this.toPixCharge(row);
  }

  async getChargeById(tenantId: string, chargeId: string): Promise<PixCharge | null> {
    const row = await runQueryWithTenant<PixChargeRow>(
      tenantId,
      `
      SELECT id, tenant_id, payment_intent_id, provider, provider_charge_id,
             amount, currency, status, expires_at, paid_at,
             payload_snapshot, metadata, created_at, updated_at
      FROM pix_charges
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, chargeId]
    );

    if (!row) {
      return null;
    }

    return this.toPixCharge(row);
  }

  async getChargeByPaymentIntent(
    tenantId: string,
    paymentIntentId: string
  ): Promise<PixCharge | null> {
    const row = await runQueryWithTenant<PixChargeRow>(
      tenantId,
      `
      SELECT id, tenant_id, payment_intent_id, provider, provider_charge_id,
             amount, currency, status, expires_at, paid_at,
             payload_snapshot, metadata, created_at, updated_at
      FROM pix_charges
      WHERE tenant_id = $1 AND payment_intent_id = $2
      `,
      [tenantId, paymentIntentId]
    );

    if (!row) {
      return null;
    }

    return this.toPixCharge(row);
  }

  async getChargeByProviderChargeId(
    tenantId: string,
    provider: string,
    providerChargeId: string
  ): Promise<PixCharge | null> {
    const row = await runQueryWithTenant<PixChargeRow>(
      tenantId,
      `
      SELECT id, tenant_id, payment_intent_id, provider, provider_charge_id,
             amount, currency, status, expires_at, paid_at,
             payload_snapshot, metadata, created_at, updated_at
      FROM pix_charges
      WHERE tenant_id = $1 AND provider = $2 AND provider_charge_id = $3
      `,
      [tenantId, provider, providerChargeId]
    );

    if (!row) {
      return null;
    }

    return this.toPixCharge(row);
  }

  async markAsPaid(tenantId: string, chargeId: string, paidAt: Date): Promise<PixCharge> {
    const row = await runQueryWithTenant<PixChargeRow>(
      tenantId,
      `
      UPDATE pix_charges
      SET status = 'PAID', paid_at = $3, updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status = 'CREATED'
      RETURNING id, tenant_id, payment_intent_id, provider, provider_charge_id,
                amount, currency, status, expires_at, paid_at,
                payload_snapshot, metadata, created_at, updated_at
      `,
      [tenantId, chargeId, paidAt]
    );

    if (!row) {
      throw new Error('PIX charge não encontrado ou já pago/expirado');
    }
    return this.toPixCharge(row);
  }

  async expireCharge(tenantId: string, chargeId: string): Promise<PixCharge> {
    const row = await runQueryWithTenant<PixChargeRow>(
      tenantId,
      `
      UPDATE pix_charges
      SET status = 'EXPIRED', updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status = 'CREATED'
      RETURNING id, tenant_id, payment_intent_id, provider, provider_charge_id,
                amount, currency, status, expires_at, paid_at,
                payload_snapshot, metadata, created_at, updated_at
      `,
      [tenantId, chargeId]
    );

    if (!row) {
      throw new Error('PIX charge não encontrado ou já expirado');
    }
    return this.toPixCharge(row);
  }
}

export const pixChargeRepository = new PixChargeRepository();
