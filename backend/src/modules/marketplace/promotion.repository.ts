// backend/src/modules/marketplace/promotion.repository.ts
// SPRINT 48 — §4.7 discount_fixed_cents, §4.8 discount_rate_bps, §4.11 lowercase

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  Promotion,
  CreatePromotionInput,
  PromotionAppliesTo,
  PromotionType,
} from './pricing.types';

interface PromotionRow {
  id: string;
  tenant_id: string;
  name: string;
  type: string;
  discount_fixed_cents: string | number;
  discount_rate_bps: string | number;
  applies_to: string;
  applies_id: string;
  valid_from: Date;
  valid_to: Date | null;
  is_active: boolean;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

function normType(t: string): PromotionType {
  const x = String(t).toLowerCase().trim();
  if (x === 'percentage' || x === 'fixed') return x;
  return x as PromotionType;
}

function normApplies(a: string): PromotionAppliesTo {
  const x = String(a).toLowerCase().trim();
  if (x === 'variant' || x === 'category' || x === 'product') return x;
  const u = x.toUpperCase();
  if (u === 'VARIANT') return 'variant';
  if (u === 'CATEGORY') return 'category';
  if (u === 'PRODUCT') return 'product';
  return x as PromotionAppliesTo;
}

function rowBigint(v: string | number): number {
  return typeof v === 'number' ? v : parseInt(String(v), 10);
}

function rowInt(v: string | number): number {
  return typeof v === 'number' ? v : parseInt(String(v), 10);
}

class PromotionRepository {
  private toPromotion(row: PromotionRow): Promotion {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      type: normType(row.type),
      discountFixedCents: rowBigint(row.discount_fixed_cents),
      discountRateBps: rowInt(row.discount_rate_bps),
      appliesTo: normApplies(row.applies_to),
      appliesId: row.applies_id,
      validFrom: row.valid_from,
      validTo: row.valid_to,
      isActive: row.is_active,
      metadata: row.metadata || null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  async createPromotion(
    tenantId: string,
    input: CreatePromotionInput
  ): Promise<Promotion> {
    const discountFixedCents = input.discountFixedCents ?? 0;
    const discountRateBps = input.discountRateBps ?? 0;

    const row = await runQueryWithTenant<PromotionRow>(
      tenantId,
      `
      INSERT INTO promotions (
        tenant_id, name, type, discount_fixed_cents, discount_rate_bps,
        applies_to, applies_id,
        valid_from, valid_to, is_active, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, tenant_id, name, type, discount_fixed_cents, discount_rate_bps,
                applies_to, applies_id,
                valid_from, valid_to, is_active, metadata, created_at, updated_at
      `,
      [
        tenantId,
        input.name,
        input.type,
        discountFixedCents,
        discountRateBps,
        input.appliesTo,
        input.appliesId,
        input.validFrom || new Date(),
        input.validTo || null,
        input.isActive !== false,
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar promoção');
    }

    return this.toPromotion(row);
  }

  async getApplicablePromotions(
    tenantId: string,
    variantId: string,
    productId: string | null,
    categoryId: string | null,
    date: Date = new Date()
  ): Promise<Promotion[]> {
    const conditions: string[] = [];
    const params: any[] = [tenantId, date];
    let paramIndex = 3;

    conditions.push(`(applies_to = 'variant' AND applies_id = $${paramIndex})`);
    params.push(variantId);
    paramIndex++;

    if (productId) {
      conditions.push(`(applies_to = 'product' AND applies_id = $${paramIndex})`);
      params.push(productId);
      paramIndex++;
    }

    if (categoryId) {
      conditions.push(`(applies_to = 'category' AND applies_id = $${paramIndex})`);
      params.push(categoryId);
      paramIndex++;
    }

    const whereClause = conditions.join(' OR ');

    const rows = await runQueriesWithTenant<PromotionRow>(
      tenantId,
      `
      SELECT id, tenant_id, name, type, discount_fixed_cents, discount_rate_bps,
             applies_to, applies_id,
             valid_from, valid_to, is_active, metadata, created_at, updated_at
      FROM promotions
      WHERE tenant_id = $1
        AND is_active = true
        AND valid_from <= $2
        AND (valid_to IS NULL OR valid_to > $2)
        AND (${whereClause})
      ORDER BY valid_from DESC
      `,
      params
    );

    return rows.map((row) => this.toPromotion(row));
  }

  async listPromotions(
    tenantId: string,
    isActive?: boolean
  ): Promise<Promotion[]> {
    let query = `
      SELECT id, tenant_id, name, type, discount_fixed_cents, discount_rate_bps,
             applies_to, applies_id,
             valid_from, valid_to, is_active, metadata, created_at, updated_at
      FROM promotions
      WHERE tenant_id = $1
    `;
    const params: any[] = [tenantId];

    if (isActive !== undefined) {
      query += ` AND is_active = $2`;
      params.push(isActive);
    }

    query += ` ORDER BY created_at DESC`;

    const rows = await runQueriesWithTenant<PromotionRow>(
      tenantId,
      query,
      params
    );

    return rows.map((row) => this.toPromotion(row));
  }
}

export const promotionRepository = new PromotionRepository();
