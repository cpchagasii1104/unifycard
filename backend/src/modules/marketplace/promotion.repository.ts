// backend/src/modules/marketplace/promotion.repository.ts
// SPRINT 48: Repository para promoções

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  Promotion,
  CreatePromotionInput,
} from './pricing.types';

interface PromotionRow {
  id: string;
  tenant_id: string;
  name: string;
  type: string;
  value: string;
  applies_to: string;
  applies_id: string;
  valid_from: Date;
  valid_to: Date | null;
  is_active: boolean;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

class PromotionRepository {
  /**
   * Converte row para Promotion
   */
  private toPromotion(row: PromotionRow): Promotion {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      type: row.type as any,
      valueCents: parseFloat(row.value),
      appliesTo: row.applies_to as any,
      appliesId: row.applies_id,
      validFrom: row.valid_from,
      validTo: row.valid_to,
      isActive: row.is_active,
      metadata: row.metadata || null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Cria promoção
   */
  async createPromotion(
    tenantId: string,
    input: CreatePromotionInput
  ): Promise<Promotion> {
    const row = await runQueryWithTenant<PromotionRow>(
      tenantId,
      `
      INSERT INTO promotions (
        tenant_id, name, type, value, applies_to, applies_id,
        valid_from, valid_to, is_active, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, tenant_id, name, type, value, applies_to, applies_id,
                valid_from, valid_to, is_active, metadata, createdAt, updatedAt
      `,
      [
        tenantId,
        input.name,
        input.type,
        input.value,
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

  /**
   * Busca promoções aplicáveis a uma variante
   */
  async getApplicablePromotions(
    tenantId: string,
    variantId: string,
    productId: string | null,
    categoryId: string | null,
    date: Date = new Date()
  ): Promise<Promotion[]> {
    // Buscar promoções que se aplicam à variante, produto ou categoria
    const conditions: string[] = [];
    const params: any[] = [tenantId, date];
    let paramIndex = 3;

    // Promoção aplicada diretamente à variante
    conditions.push(`(applies_to = 'VARIANT' AND applies_id = $${paramIndex})`);
    params.push(variantId);
    paramIndex++;

    // Promoção aplicada ao produto
    if (productId) {
      conditions.push(`(applies_to = 'PRODUCT' AND applies_id = $${paramIndex})`);
      params.push(productId);
      paramIndex++;
    }

    // Promoção aplicada à categoria
    if (categoryId) {
      conditions.push(`(applies_to = 'CATEGORY' AND applies_id = $${paramIndex})`);
      params.push(categoryId);
      paramIndex++;
    }

    const whereClause = conditions.join(' OR ');

    const rows = await runQueriesWithTenant<PromotionRow>(
      tenantId,
      `
      SELECT id, tenant_id, name, type, value, applies_to, applies_id,
             valid_from, valid_to, is_active, metadata, createdAt, updatedAt
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

  /**
   * Lista promoções
   */
  async listPromotions(
    tenantId: string,
    isActive?: boolean
  ): Promise<Promotion[]> {
    let query = `
      SELECT id, tenant_id, name, type, value, applies_to, applies_id,
             valid_from, valid_to, is_active, metadata, createdAt, updatedAt
      FROM promotions
      WHERE tenant_id = $1
    `;
    const params: any[] = [tenantId];

    if (isActive !== undefined) {
      query += ` AND is_active = $2`;
      params.push(isActive);
    }

    query += ` ORDER BY createdAt DESC`;

    const rows = await runQueriesWithTenant<PromotionRow>(
      tenantId,
      query,
      params
    );

    return rows.map((row) => this.toPromotion(row));
  }
}

export const promotionRepository = new PromotionRepository();










