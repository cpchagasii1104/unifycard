// src/core/profile/profile-health.repository.ts
// Repository para autodeclarações de saúde V2 (raio-x estruturado)

import { pool } from '@core/database/pool';
import type { HealthDeclaration, HealthDeclarationRow, HealthSection } from './profile-health.types';

export class ProfileHealthRepository {
  /**
   * Converte row do banco para objeto HealthDeclaration
   */
  private toHealthDeclaration(row: HealthDeclarationRow): HealthDeclaration {
    // Parse payload se for string (JSONB pode vir como string em alguns casos)
    let payload = row.payload;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        payload = null;
      }
    }

    return {
      id: row.id,
      tenantId: row.tenant_id,
      actorId: row.actor_id,
      declarationText: row.declaration_text,
      notes: row.notes,
      consent: row.consent,
      section: row.section,
      payload: payload as Record<string, any> | null,
      consentScope: row.consent_scope,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  /**
   * Busca todas as declarações de saúde de um actor
   * Opcionalmente filtra por seção
   */
  async findByActorId(
    tenantId: string,
    actorId: string,
    section?: HealthSection | null
  ): Promise<HealthDeclaration[]> {
    let query = `
      SELECT id, tenant_id, actor_id, declaration_text, notes, consent, 
             section, payload, consent_scope, created_at, updated_at
      FROM health_declarations
      WHERE tenant_id = $1 AND actor_id = $2
    `;
    const params: any[] = [tenantId, actorId];

    if (section !== undefined && section !== null) {
      query += ` AND section = $3`;
      params.push(section);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await pool.query<HealthDeclarationRow>(query, params);

    return result.rows.map((row) => this.toHealthDeclaration(row));
  }

  /**
   * Busca declaração por ID
   */
  async findById(tenantId: string, id: string): Promise<HealthDeclaration | null> {
    const result = await pool.query<HealthDeclarationRow>(
      `
      SELECT id, tenant_id, actor_id, declaration_text, notes, consent,
             section, payload, consent_scope, created_at, updated_at
      FROM health_declarations
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
      `,
      [tenantId, id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.toHealthDeclaration(result.rows[0]);
  }

  /**
   * Cria nova declaração de saúde (V2: suporta dados estruturados)
   */
  async create(
    tenantId: string,
    actorId: string,
    input: {
      declarationText?: string;
      notes?: string | null;
      consent: boolean;
      section?: HealthSection | null;
      payload?: Record<string, any> | null;
      consentScope?: string | null;
    }
  ): Promise<HealthDeclaration> {
    // Validar consentimento obrigatório
    if (!input.consent) {
      throw new Error('Consentimento é obrigatório e deve ser true');
    }

    // Validar que pelo menos declarationText OU payload seja fornecido
    if (!input.declarationText && !input.payload) {
      throw new Error('É necessário fornecer declarationText ou payload');
    }

    // Validar section se fornecida
    const validSections: HealthSection[] = ['general', 'vision', 'dental', 'medications', 'mobility', 'mental', 'other'];
    if (input.section && !validSections.includes(input.section)) {
      throw new Error(`Section inválida. Valores permitidos: ${validSections.join(', ')}`);
    }

    const result = await pool.query<HealthDeclarationRow>(
      `
      INSERT INTO health_declarations 
        (tenant_id, actor_id, declaration_text, notes, consent, section, payload, consent_scope)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, tenant_id, actor_id, declaration_text, notes, consent, 
                section, payload, consent_scope, created_at, updated_at
      `,
      [
        tenantId,
        actorId,
        input.declarationText || '', // Fallback para string vazia se não fornecido
        input.notes || null,
        input.consent,
        input.section || null,
        input.payload ? JSON.stringify(input.payload) : null,
        input.consentScope || null,
      ]
    );

    return this.toHealthDeclaration(result.rows[0]);
  }

  /**
   * Remove declaração de saúde (soft delete ou hard delete)
   */
  async delete(tenantId: string, id: string): Promise<void> {
    const result = await pool.query(
      `
      DELETE FROM health_declarations
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, id]
    );

    if (result.rowCount === 0) {
      throw new Error('Declaração de saúde não encontrada');
    }
  }
}

export const profileHealthRepository = new ProfileHealthRepository();


