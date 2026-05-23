// backend/src/modules/organization/organization-unit.repository.ts
// SPRINT 51: Repository para unidades organizacionais

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  OrganizationUnit,
  CreateOrganizationUnitInput,
  UpdateOrganizationUnitInput,
  OrganizationUnitTree,
} from './organization.types';

interface OrganizationUnitRow {
  id: string;
  tenant_id: string;
  name: string;
  type: string;
  parent_id: string | null;
  slug?: string;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

class OrganizationUnitRepository {
  /**
   * Converte row para OrganizationUnit
   */
  private toUnit(row: OrganizationUnitRow): OrganizationUnit {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      type: row.type,
      parentId: row.parent_id,
      slug: row.slug ?? '',
      metadata: (row.metadata as Record<string, unknown>) ?? undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  /**
   * Cria unidade organizacional
   */
  async createUnit(
    tenantId: string,
    input: CreateOrganizationUnitInput
  ): Promise<OrganizationUnit> {
    const row = await runQueryWithTenant<OrganizationUnitRow>(
      tenantId,
      `
      INSERT INTO organization_units (
        tenant_id, name, type, parent_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, tenant_id, name, type, parent_id, metadata, created_at, updated_at
      `,
      [
        tenantId,
        input.name,
        input.type ?? 'UNIT',
        input.parentId || null,
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar unidade organizacional');
    }

    return this.toUnit(row);
  }

  /**
   * Atualiza unidade organizacional
   */
  async updateUnit(
    tenantId: string,
    unitId: string,
    input: UpdateOrganizationUnitInput
  ): Promise<OrganizationUnit> {
    const updates: string[] = [];
    const params: any[] = [tenantId, unitId];
    let paramIndex = 3;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      params.push(input.name);
      paramIndex++;
    }

    if (input.type !== undefined) {
      updates.push(`type = $${paramIndex}`);
      params.push(input.type);
      paramIndex++;
    }

    if (input.parentId !== undefined) {
      updates.push(`parent_id = $${paramIndex}`);
      params.push(input.parentId || null);
      paramIndex++;
    }

    if (input.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex}`);
      params.push(JSON.stringify(input.metadata));
      paramIndex++;
    }

    if (updates.length === 0) {
      // Nenhuma atualização, retornar unidade atual
      return await this.getUnitById(tenantId, unitId) || ({} as OrganizationUnit);
    }

    updates.push(`updated_at = NOW()`);

    const row = await runQueryWithTenant<OrganizationUnitRow>(
      tenantId,
      `
      UPDATE organization_units
      SET ${updates.join(', ')}
      WHERE tenant_id = $1 AND id = $2
      RETURNING id, tenant_id, name, type, parent_id, metadata, created_at, updated_at
      `,
      params
    );

    if (!row) {
      throw new Error(`Unidade organizacional não encontrada: ${unitId}`);
    }

    return this.toUnit(row);
  }

  /**
   * Busca unidade por ID
   */
  async getUnitById(
    tenantId: string,
    unitId: string
  ): Promise<OrganizationUnit | null> {
    const row = await runQueryWithTenant<OrganizationUnitRow>(
      tenantId,
      `
      SELECT id, tenant_id, name, type, parent_id, metadata, created_at, updated_at
      FROM organization_units
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, unitId]
    );

    return row ? this.toUnit(row) : null;
  }

  /**
   * Lista unidades organizacionais
   */
  async listUnits(
    tenantId: string,
    parentId?: string | null,
    type?: string
  ): Promise<OrganizationUnit[]> {
    let query = `
      SELECT id, tenant_id, name, type, parent_id, metadata, created_at, updated_at
      FROM organization_units
      WHERE tenant_id = $1
    `;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (parentId !== undefined) {
      if (parentId === null) {
        query += ` AND parent_id IS NULL`;
      } else {
        query += ` AND parent_id = $${paramIndex}`;
        params.push(parentId);
        paramIndex++;
      }
    }

    if (type) {
      query += ` AND type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    query += ` ORDER BY name ASC`;

    const rows = await runQueriesWithTenant<OrganizationUnitRow>(tenantId, query, params);
    return rows.map((row) => this.toUnit(row));
  }

  /**
   * Busca unidades filhas (children)
   */
  async getChildren(
    tenantId: string,
    parentId: string
  ): Promise<OrganizationUnit[]> {
    return await this.listUnits(tenantId, parentId);
  }

  /**
   * Busca todas as unidades descendentes (recursivo)
   */
  async getDescendants(
    tenantId: string,
    parentId: string
  ): Promise<OrganizationUnit[]> {
    // Buscar todas as unidades descendentes usando CTE recursivo
    const rows = await runQueriesWithTenant<OrganizationUnitRow>(
      tenantId,
      `
      WITH RECURSIVE descendants AS (
        SELECT id, tenant_id, name, type, parent_id, metadata, created_at, updated_at
        FROM organization_units
        WHERE tenant_id = $1 AND parent_id = $2
        
        UNION ALL
        
        SELECT ou.id, ou.tenant_id, ou.name, ou.type, ou.parent_id, ou.metadata, ou.created_at, ou.updated_at
        FROM organization_units ou
        INNER JOIN descendants d ON ou.parent_id = d.id
        WHERE ou.tenant_id = $1
      )
      SELECT id, tenant_id, name, type, parent_id, metadata, created_at, updated_at
      FROM descendants
      ORDER BY name ASC
      `,
      [tenantId, parentId]
    );

    return rows.map((row) => this.toUnit(row));
  }

  /**
   * Busca unidade por actor
   */
  async getUnitByActor(
    tenantId: string,
    actorId: string
  ): Promise<OrganizationUnit | null> {
    const row = await runQueryWithTenant<OrganizationUnitRow>(
      tenantId,
      `
      SELECT ou.id, ou.tenant_id, ou.name, ou.type, ou.parent_id, ou.metadata, ou.created_at, ou.updated_at
      FROM organization_units ou
      INNER JOIN actors a ON a.organization_unit_id = ou.id
      WHERE ou.tenant_id = $1 AND a.actor_id = $2
      LIMIT 1
      `,
      [tenantId, actorId]
    );

    return row ? this.toUnit(row) : null;
  }
}

export const organizationUnitRepository = new OrganizationUnitRepository();









