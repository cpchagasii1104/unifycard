// backend/src/modules/presence/promo-benefit.repository.ts
// SPRINT 94: PRESENÇA + CHECK-IN SOCIAL + BENEFÍCIOS PROMOCIONAIS

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  PromoBenefit,
  PromoBenefitRedemption,
  PresenceContextType,
  PromoBenefitStatus,
} from './presence.types';

interface PromoBenefitRow {
  id: string;
  tenant_id: string;
  context_type: string;
  context_id: string;
  benefit_type: string;
  benefit_value: string;
  status: string;
  requires_checkin: boolean;
  max_redemptions: string | null;
  per_contact_limit: string;
  valid_from: Date | null;
  valid_to: Date | null;
  metadata: any;
  created_at: Date;
}

interface PromoBenefitRedemptionRow {
  id: string;
  tenant_id: string;
  benefit_id: string;
  contact_id: string;
  checkin_id: string | null;
  loyalty_ledger_id: string | null;
  voucher_id: string | null;
  metadata: any;
  created_at: Date;
}

class PromoBenefitRepository {
  private toPromoBenefit(row: PromoBenefitRow): PromoBenefit {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      contextType: row.context_type as PresenceContextType,
      contextId: row.context_id,
      benefitType: row.benefit_type as any,
      benefitValue: parseFloat(row.benefit_value),
      status: row.status as PromoBenefitStatus,
      requiresCheckin: row.requires_checkin,
      maxRedemptions: row.max_redemptions ? parseInt(row.max_redemptions, 10) : null,
      perContactLimit: parseInt(row.per_contact_limit, 10),
      validFrom: row.valid_from,
      validTo: row.valid_to,
      metadata: row.metadata || {},
      createdAt: row.created_at,
    };
  }

  private toPromoBenefitRedemption(row: PromoBenefitRedemptionRow): PromoBenefitRedemption {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      benefitId: row.benefit_id,
      contactId: row.contact_id,
      checkinId: row.checkin_id,
      loyaltyLedgerId: row.loyalty_ledger_id,
      voucherId: row.voucher_id,
      metadata: row.metadata || {},
      createdAt: row.created_at,
    };
  }

  async createBenefit(
    tenantId: string,
    contextType: PresenceContextType,
    contextId: string,
    benefitType: string,
    benefitValue: number,
    requiresCheckin: boolean,
    maxRedemptions: number | null,
    perContactLimit: number,
    validFrom: Date | null,
    validTo: Date | null,
    metadata?: Record<string, any>
  ): Promise<PromoBenefit> {
    const row = await runQueryWithTenant<PromoBenefitRow>(
      tenantId,
      `
      INSERT INTO promo_benefits (
        tenant_id, context_type, context_id, benefit_type, benefit_value, status,
        requires_checkin, max_redemptions, per_contact_limit, valid_from, valid_to, metadata
      )
      VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6, $7, $8, $9, $10, $11::jsonb)
      RETURNING id, tenant_id, context_type, context_id, benefit_type, benefit_value, status,
                requires_checkin, max_redemptions, per_contact_limit, valid_from, valid_to, metadata, created_at
      `,
      [
        tenantId,
        contextType,
        contextId,
        benefitType,
        benefitValue,
        requiresCheckin,
        maxRedemptions,
        perContactLimit,
        validFrom,
        validTo,
        JSON.stringify(metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar benefício promocional');
    }

    return this.toPromoBenefit(row);
  }

  async listBenefits(
    tenantId: string,
    contextType: PresenceContextType,
    contextId: string
  ): Promise<PromoBenefit[]> {
    const now = new Date();

    const rows = await runQueriesWithTenant<PromoBenefitRow>(
      tenantId,
      `
      SELECT id, tenant_id, context_type, context_id, benefit_type, benefit_value, status,
             requires_checkin, max_redemptions, per_contact_limit, valid_from, valid_to, metadata, created_at
      FROM promo_benefits
      WHERE tenant_id = $1 AND context_type = $2 AND context_id = $3
        AND status = 'ACTIVE'
        AND (valid_from IS NULL OR valid_from <= $4)
        AND (valid_to IS NULL OR valid_to >= $4)
      ORDER BY created_at DESC
      `,
      [tenantId, contextType, contextId, now]
    );

    return rows.map((row) => this.toPromoBenefit(row));
  }

  async getBenefitById(tenantId: string, benefitId: string): Promise<PromoBenefit | null> {
    const row = await runQueryWithTenant<PromoBenefitRow>(
      tenantId,
      `
      SELECT id, tenant_id, context_type, context_id, benefit_type, benefit_value, status,
             requires_checkin, max_redemptions, per_contact_limit, valid_from, valid_to, metadata, created_at
      FROM promo_benefits
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, benefitId]
    );

    return row ? this.toPromoBenefit(row) : null;
  }

  async hasRedeemed(
    tenantId: string,
    benefitId: string,
    contactId: string
  ): Promise<boolean> {
    const row = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
      SELECT COUNT(*)::TEXT as count
      FROM promo_benefit_redemptions
      WHERE tenant_id = $1 AND benefit_id = $2 AND contact_id = $3
      `,
      [tenantId, benefitId, contactId]
    );

    return row ? parseInt(row.count, 10) > 0 : false;
  }

  async createRedemption(
    tenantId: string,
    benefitId: string,
    contactId: string,
    checkinId: string | null,
    loyaltyLedgerId: string | null,
    voucherId: string | null,
    metadata?: Record<string, any>
  ): Promise<PromoBenefitRedemption> {
    // Tentar inserir (idempotente)
    const row = await runQueryWithTenant<PromoBenefitRedemptionRow>(
      tenantId,
      `
      INSERT INTO promo_benefit_redemptions (
        tenant_id, benefit_id, contact_id, checkin_id, loyalty_ledger_id, voucher_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      ON CONFLICT (tenant_id, benefit_id, contact_id) DO NOTHING
      RETURNING id, tenant_id, benefit_id, contact_id, checkin_id, loyalty_ledger_id, voucher_id, metadata, created_at
      `,
      [
        tenantId,
        benefitId,
        contactId,
        checkinId,
        loyaltyLedgerId,
        voucherId,
        JSON.stringify(metadata || {}),
      ]
    );

    // Se já existe (idempotência), buscar existente
    if (!row) {
      const existing = await runQueryWithTenant<PromoBenefitRedemptionRow>(
        tenantId,
        `
        SELECT id, tenant_id, benefit_id, contact_id, checkin_id, loyalty_ledger_id, voucher_id, metadata, created_at
        FROM promo_benefit_redemptions
        WHERE tenant_id = $1 AND benefit_id = $2 AND contact_id = $3
        `,
        [tenantId, benefitId, contactId]
      );

      if (!existing) {
        throw new Error('Erro ao criar resgate de benefício');
      }

      return this.toPromoBenefitRedemption(existing);
    }

    return this.toPromoBenefitRedemption(row);
  }

  async getRedemptionCount(tenantId: string, benefitId: string): Promise<number> {
    const row = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
      SELECT COUNT(*)::TEXT as count
      FROM promo_benefit_redemptions
      WHERE tenant_id = $1 AND benefit_id = $2
      `,
      [tenantId, benefitId]
    );

    return row ? parseInt(row.count, 10) : 0;
  }
}

export const promoBenefitRepository = new PromoBenefitRepository();





