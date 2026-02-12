// backend/src/modules/loyalty/loyalty-rule.repository.ts
// SPRINT 93: LOYALTY / FIDELIDADE

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  LoyaltyRule,
  CreateLoyaltyRuleInput,
  LoyaltyRuleFilters,
  LoyaltyRuleStatus,
} from './loyalty.types';

interface LoyaltyRuleRow {
  id: string;
  tenant_id: string;
  name: string;
  status: string;
  rule_type: string;
  valueCents: string;
  applies_to: string;
  applies_id: string | null;
  min_amount: string | null;
  max_points_per_day: string | null;
  valid_from: Date | null;
  valid_to: Date | null;
  metadata: any;
  createdAt: Date;
}

class LoyaltyRuleRepository {
  private toLoyaltyRule(row: LoyaltyRuleRow): LoyaltyRule {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      status: row.status as LoyaltyRuleStatus,
      ruleType: row.rule_type as any,
      valueCents: parseFloat(row.value),
      appliesTo: row.applies_to as any,
      appliesId: row.applies_id,
      minAmount: row.min_amount ? parseFloat(row.min_amount) : null,
      maxPointsPerDay: row.max_points_per_day ? parseInt(row.max_points_per_day, 10) : null,
      validFrom: row.valid_from,
      validTo: row.valid_to,
      metadata: row.metadata || {},
      createdAt: row.createdAt.toISOString(),
    };
  }

  async createRule(tenantId: string, input: CreateLoyaltyRuleInput): Promise<LoyaltyRule> {
    const row = await runQueryWithTenant<LoyaltyRuleRow>(
      tenantId,
      `
      INSERT INTO loyalty_rules (
        tenant_id, name, status, rule_type, value, applies_to, applies_id,
        min_amount, max_points_per_day, valid_from, valid_to, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
      RETURNING id, tenant_id, name, status, rule_type, value, applies_to, applies_id,
                min_amount, max_points_per_day, valid_from, valid_to, metadata, createdAt
      `,
      [
        tenantId,
        input.name,
        input.status || 'ACTIVE',
        input.ruleType,
        input.value,
        input.appliesTo,
        input.appliesId || null,
        input.minAmount || null,
        input.maxPointsPerDay || null,
        input.validFrom || null,
        input.validTo || null,
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar regra de fidelidade');
    }

    return this.toLoyaltyRule(row);
  }

  async getRuleById(tenantId: string, ruleId: string): Promise<LoyaltyRule | null> {
    const row = await runQueryWithTenant<LoyaltyRuleRow>(
      tenantId,
      `
      SELECT id, tenant_id, name, status, rule_type, value, applies_to, applies_id,
             min_amount, max_points_per_day, valid_from, valid_to, metadata, createdAt
      FROM loyalty_rules
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, ruleId]
    );

    return row ? this.toLoyaltyRule(row) : null;
  }

  async listRules(tenantId: string, filters: LoyaltyRuleFilters = {}): Promise<LoyaltyRule[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.appliesTo) {
      conditions.push(`applies_to = $${paramIndex}`);
      params.push(filters.appliesTo);
      paramIndex++;
    }

    if (filters.appliesId) {
      conditions.push(`applies_id = $${paramIndex}`);
      params.push(filters.appliesId);
      paramIndex++;
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const rows = await runQueriesWithTenant<LoyaltyRuleRow>(
      tenantId,
      `
      SELECT id, tenant_id, name, status, rule_type, value, applies_to, applies_id,
             min_amount, max_points_per_day, valid_from, valid_to, metadata, createdAt
      FROM loyalty_rules
      WHERE ${conditions.join(' AND ')}
      ORDER BY createdAt DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...params, limit, offset]
    );

    return rows.map((row) => this.toLoyaltyRule(row));
  }

  /**
   * Busca regras aplicáveis para uma transação
   */
  async getApplicableRules(
    tenantId: string,
    channel: string,
    actorId?: string,
    productVariantId?: string,
    categoryId?: string
  ): Promise<LoyaltyRule[]> {
    const now = new Date();

    const rows = await runQueriesWithTenant<LoyaltyRuleRow>(
      tenantId,
      `
      SELECT id, tenant_id, name, status, rule_type, value, applies_to, applies_id,
             min_amount, max_points_per_day, valid_from, valid_to, metadata, createdAt
      FROM loyalty_rules
      WHERE tenant_id = $1
        AND status = 'ACTIVE'
        AND (valid_from IS NULL OR valid_from <= $2)
        AND (valid_to IS NULL OR valid_to >= $2)
        AND (
          (applies_to = 'CHANNEL' AND applies_id = $3)
          OR (applies_to = 'ACTOR' AND applies_id = $4)
          OR (applies_to = 'VARIANT' AND applies_id = $5)
          OR (applies_to = 'CATEGORY' AND applies_id = $6)
          OR (applies_to = 'CHANNEL' AND applies_id IS NULL)
        )
      ORDER BY createdAt DESC
      `,
      [tenantId, now, channel, actorId || null, productVariantId || null, categoryId || null]
    );

    return rows.map((row) => this.toLoyaltyRule(row));
  }

  async updateRuleStatus(tenantId: string, ruleId: string, status: LoyaltyRuleStatus): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `
      UPDATE loyalty_rules
      SET status = $1
      WHERE tenant_id = $2 AND id = $3
      `,
      [status, tenantId, ruleId]
    );
  }
}

export const loyaltyRuleRepository = new LoyaltyRuleRepository();








