// src/core/profile/profile-health-facts.repository.ts
// Repository para fatos de saúde do usuário (user_health_facts)

import { pool } from '@core/database/pool';
import type { HealthCategory } from './profile-health-taxonomy.repository';

export interface UserHealthFact {
  factId: string;
  tenantId: string;
  actorId: string;
  taxonomyId: string;
  valueText: string | null;
  valueNumber: number | null;
  valueBoolean: boolean | null;
  valueDate: Date | null;
  notes: string | null;
  metadata: Record<string, any>;
  healthDeclarationId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserHealthFactRow {
  fact_id: string;
  tenant_id: string;
  actor_id: string;
  taxonomy_id: string;
  value_text: string | null;
  value_number: number | null;
  value_boolean: boolean | null;
  value_date: Date | null;
  notes: string | null;
  metadata: Record<string, any>;
  health_declaration_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserHealthFactInput {
  taxonomyId: string;
  valueText?: string | null;
  valueNumber?: number | null;
  valueBoolean?: boolean | null;
  valueDate?: Date | string | null;
  notes?: string | null;
  metadata?: Record<string, any>;
  healthDeclarationId?: string | null;
}

export class ProfileHealthFactsRepository {
  private toUserHealthFact(row: UserHealthFactRow): UserHealthFact {
    return {
      factId: row.fact_id,
      tenantId: row.tenant_id,
      actorId: row.actor_id,
      taxonomyId: row.taxonomy_id,
      valueText: row.value_text,
      valueNumber: row.value_number,
      valueBoolean: row.value_boolean,
      valueDate: row.value_date,
      notes: row.notes,
      metadata: row.metadata || {},
      healthDeclarationId: row.health_declaration_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Busca fatos de saúde de um actor
   */
  async findByActorId(tenantId: string, actorId: string): Promise<UserHealthFact[]> {
    const result = await pool.query<UserHealthFactRow>(
      `
      SELECT fact_id, tenant_id, actor_id, taxonomy_id, value_text, value_number,
             value_boolean, value_date, notes, metadata, health_declaration_id,
             created_at, updated_at
      FROM user_health_facts
      WHERE tenant_id = $1 AND actor_id = $2
      ORDER BY created_at DESC
      `,
      [tenantId, actorId]
    );

    return result.rows.map((row) => this.toUserHealthFact(row));
  }

  /**
   * Busca fatos por categoria
   */
  async findByCategory(
    tenantId: string,
    actorId: string,
    category: HealthCategory
  ): Promise<UserHealthFact[]> {
    const result = await pool.query<UserHealthFactRow>(
      `
      SELECT f.fact_id, f.tenant_id, f.actor_id, f.taxonomy_id, f.value_text, f.value_number,
             f.value_boolean, f.value_date, f.notes, f.metadata, f.health_declaration_id,
             f.created_at, f.updated_at
      FROM user_health_facts f
      INNER JOIN health_taxonomies t ON t.taxonomy_id = f.taxonomy_id
      WHERE f.tenant_id = $1 AND f.actor_id = $2 AND t.category = $3
      ORDER BY f.created_at DESC
      `,
      [tenantId, actorId, category]
    );

    return result.rows.map((row) => this.toUserHealthFact(row));
  }

  /**
   * Busca fato por taxonomy_id
   */
  async findByTaxonomyId(
    tenantId: string,
    actorId: string,
    taxonomyId: string
  ): Promise<UserHealthFact | null> {
    const result = await pool.query<UserHealthFactRow>(
      `
      SELECT fact_id, tenant_id, actor_id, taxonomy_id, value_text, value_number,
             value_boolean, value_date, notes, metadata, health_declaration_id,
             created_at, updated_at
      FROM user_health_facts
      WHERE tenant_id = $1 AND actor_id = $2 AND taxonomy_id = $3
      LIMIT 1
      `,
      [tenantId, actorId, taxonomyId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.toUserHealthFact(result.rows[0]);
  }

  /**
   * Cria ou atualiza fato de saúde
   */
  async upsert(
    tenantId: string,
    actorId: string,
    input: CreateUserHealthFactInput
  ): Promise<UserHealthFact> {
    // Validar que exatamente um valor foi fornecido
    const valueCount = [
      input.valueText !== undefined && input.valueText !== null,
      input.valueNumber !== undefined && input.valueNumber !== null,
      input.valueBoolean !== undefined && input.valueBoolean !== null,
      input.valueDate !== undefined && input.valueDate !== null,
    ].filter(Boolean).length;

    if (valueCount !== 1) {
      throw new Error('É necessário fornecer exatamente um valor (valueText, valueNumber, valueBoolean ou valueDate)');
    }

    // Converter valueDate se for string
    let valueDate: Date | null = null;
    if (input.valueDate) {
      valueDate = typeof input.valueDate === 'string' ? new Date(input.valueDate) : input.valueDate;
    }

    const result = await pool.query<UserHealthFactRow>(
      `
      INSERT INTO user_health_facts 
        (tenant_id, actor_id, taxonomy_id, value_text, value_number, value_boolean, 
         value_date, notes, metadata, health_declaration_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (tenant_id, actor_id, taxonomy_id)
      DO UPDATE SET
        value_text = EXCLUDED.value_text,
        value_number = EXCLUDED.value_number,
        value_boolean = EXCLUDED.value_boolean,
        value_date = EXCLUDED.value_date,
        notes = EXCLUDED.notes,
        metadata = EXCLUDED.metadata,
        health_declaration_id = EXCLUDED.health_declaration_id,
        updated_at = NOW()
      RETURNING fact_id, tenant_id, actor_id, taxonomy_id, value_text, value_number,
                value_boolean, value_date, notes, metadata, health_declaration_id,
                created_at, updated_at
      `,
      [
        tenantId,
        actorId,
        input.taxonomyId,
        input.valueText || null,
        input.valueNumber ?? null,
        input.valueBoolean ?? null,
        valueDate,
        input.notes || null,
        JSON.stringify(input.metadata || {}),
        input.healthDeclarationId || null,
      ]
    );

    return this.toUserHealthFact(result.rows[0]);
  }

  /**
   * Remove fato de saúde
   */
  async delete(tenantId: string, actorId: string, factId: string): Promise<void> {
    const result = await pool.query(
      `
      DELETE FROM user_health_facts
      WHERE tenant_id = $1 AND actor_id = $2 AND fact_id = $3
      `,
      [tenantId, actorId, factId]
    );

    if (result.rowCount === 0) {
      throw new Error('Fato de saúde não encontrado');
    }
  }

  /**
   * Remove fato por taxonomy_id (quando usuário remove declaração)
   */
  async deleteByTaxonomy(tenantId: string, actorId: string, taxonomyId: string): Promise<void> {
    await pool.query(
      `
      DELETE FROM user_health_facts
      WHERE tenant_id = $1 AND actor_id = $2 AND taxonomy_id = $3
      `,
      [tenantId, actorId, taxonomyId]
    );
  }
}

export const profileHealthFactsRepository = new ProfileHealthFactsRepository();

