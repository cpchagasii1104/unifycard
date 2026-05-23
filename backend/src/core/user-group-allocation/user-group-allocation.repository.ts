// backend/src/core/user-group-allocation/user-group-allocation.repository.ts
// CONTINUOUS PRODUCTION: Repository para alocação de grupos do usuário

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';

export interface UserGroupAllocation {
  allocationId: string;
  tenantId: string;
  userId: string;
  groupId: string;
  percentage: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserGroupAllocationInput {
  userId: string;
  groupId: string;
  percentage: number;
}

class UserGroupAllocationRepository {
  /**
   * Busca todas as alocações de um usuário
   * Retorna array vazio se não houver alocações (não lança erro)
   */
  async findByUserId(
    tenantId: string,
    userId: string
  ): Promise<UserGroupAllocation[]> {
    try {
      const rows = await runQueriesWithTenant<{
        allocation_id: string;
        tenant_id: string;
        user_id: string;
        group_id: string;
        percentage_bps: string;
        created_at: Date;
        updated_at: Date;
      }>(tenantId, {
        text: `
          SELECT 
            allocation_id,
            tenant_id,
            user_id,
            group_id,
            percentage_bps,
            created_at,
            updated_at
          FROM user_group_allocations
          WHERE tenant_id = $1 AND user_id = $2
          ORDER BY created_at ASC
        `,
        values: [tenantId, userId],
      });

      return rows.map((row) => ({
        allocationId: row.allocation_id,
        tenantId: row.tenant_id,
        userId: row.user_id,
        groupId: row.group_id,
        percentage: parseFloat(row.percentage_bps) / 100, // Converter de bps para decimal
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      // Em caso de erro (ex: tabela não existe, query falha), retornar array vazio
      // Isso permite que criação de eventos funcione mesmo sem contexto financeiro
      return [];
    }
  }

  /**
   * Busca alocação específica
   */
  async findByUserAndGroup(
    tenantId: string,
    userId: string,
    groupId: string
  ): Promise<UserGroupAllocation | null> {
      const result = await runQueryWithTenant<{
      allocation_id: string;
      tenant_id: string;
      user_id: string;
      group_id: string;
      percentage_bps: string;
      created_at: Date;
      updated_at: Date;
    }>(
      tenantId,
      `
        SELECT 
          allocation_id,
          tenant_id,
          user_id,
          group_id,
          percentage_bps,
          created_at,
          updated_at
        FROM user_group_allocations
        WHERE tenant_id = $1 AND user_id = $2 AND group_id = $3
        LIMIT 1
      `,
      [tenantId, userId, groupId]
    );

    if (!result) {
      return null;
    }

    const row = result;
    return {
      allocationId: row.allocation_id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      groupId: row.group_id,
      percentage: parseFloat(row.percentage_bps) / 100, // Converter de bps para decimal
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Cria ou atualiza alocação
   */
  async upsert(
    tenantId: string,
    input: CreateUserGroupAllocationInput
  ): Promise<UserGroupAllocation> {
      const result = await runQueryWithTenant<{
      allocation_id: string;
      tenant_id: string;
      user_id: string;
      group_id: string;
      percentage_bps: string;
      created_at: Date;
      updated_at: Date;
    }>(
      tenantId,
      `
        INSERT INTO user_group_allocations (
          tenant_id, user_id, group_id, percentage_bps
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (tenant_id, user_id, group_id)
        DO UPDATE SET
          percentage_bps = EXCLUDED.percentage_bps,
          updated_at = NOW()
        RETURNING 
          allocation_id,
          tenant_id,
          user_id,
          group_id,
          percentage_bps,
          created_at,
          updated_at
      `,
      [tenantId, input.userId, input.groupId, Math.round(input.percentage * 100)] // Converter para bps
    );

    const row = result;
    if (!row) throw new Error('Falha ao upsert alocação');
    return {
      allocationId: row.allocation_id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      groupId: row.group_id,
      percentage: parseFloat(row.percentage_bps) / 100, // Converter de bps para decimal
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Remove alocação
   */
  async delete(
    tenantId: string,
    userId: string,
    groupId: string
  ): Promise<boolean> {
    const result = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
        DELETE FROM user_group_allocations
        WHERE tenant_id = $1 AND user_id = $2 AND group_id = $3
        RETURNING allocation_id
      `,
      [tenantId, userId, groupId]
    );

    return result != null;
  }

  /**
   * Remove todas as alocações de um usuário
   */
  async deleteAllByUserId(
    tenantId: string,
    userId: string
  ): Promise<number> {
    const rows = await runQueriesWithTenant<{ allocation_id: string }>(
      tenantId,
      {
        text: `
        DELETE FROM user_group_allocations
        WHERE tenant_id = $1 AND user_id = $2
        RETURNING allocation_id
      `,
        values: [tenantId, userId],
      }
    );

    return rows.length;
  }

  /**
   * Conta alocações de um usuário
   */
  async countByUserId(
    tenantId: string,
    userId: string
  ): Promise<number> {
    const result = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
        SELECT COUNT(*)::text as count
        FROM user_group_allocations
        WHERE tenant_id = $1 AND user_id = $2
      `,
      [tenantId, userId]
    );

    return parseInt(result?.count ?? '0', 10);
  }
}

export const userGroupAllocationRepository = new UserGroupAllocationRepository();









