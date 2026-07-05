// backend/src/core/user-group-allocation/user-group-allocation.repository.ts
// CONTINUOUS PRODUCTION: Repository para alocação de grupos do usuário

import { runQueryWithTenant, runQueriesWithTenant, pool } from '@core/database/pool';

// DT-USER-GROUP-ALLOCATIONS-SILENT-CALL-CLEANUP: `findByUserId` engolia QUALQUER erro (tabela
// ausente, DB caído, permissão negada — indistinguíveis) num catch mudo, retornando `[]` sempre.
// Anti-padrão em substrato financeiro: se `user_group_allocations` for materializada no futuro,
// um bug de permissão real se disfarçaria de "sem alocação" sem log nenhum. Probe explícito
// (mesmo padrão de contact-feature.guard.ts / regional-fund-governance-feature.guard.ts desta
// sessão) distingue "tabela genuinamente ausente" (esperado hoje, log uma vez por processo) de
// "erro real de query" (propaga, nunca mais silencioso).
let userGroupAllocationsTablePresent: boolean | null = null;
let missingTableWarned = false;
async function isUserGroupAllocationsTableAvailable(): Promise<boolean> {
  if (userGroupAllocationsTablePresent) return true;
  const r = await pool.query<{ t: string | null }>(`SELECT to_regclass('public.user_group_allocations') AS t`);
  userGroupAllocationsTablePresent = r.rows[0]?.t != null;
  return userGroupAllocationsTablePresent;
}

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
   * Busca todas as alocações de um usuário. Retorna array vazio se não houver alocações OU se a
   * tabela `user_group_allocations` ainda não existir no schema vivo (caso hoje, DECISION-0048
   * cutover pendente). Erros reais de query (DB caído, permissão negada) propagam — não são mais
   * engolidos silenciosamente (DT-USER-GROUP-ALLOCATIONS-SILENT-CALL-CLEANUP).
   */
  async findByUserId(
    tenantId: string,
    userId: string
  ): Promise<UserGroupAllocation[]> {
    if (!(await isUserGroupAllocationsTableAvailable())) {
      if (!missingTableWarned) {
        missingTableWarned = true;
        console.warn(
          '[user-group-allocation.repository] tabela user_group_allocations ausente no schema vivo — ' +
            'findByUserId retorna [] por design (bank-split-engine.service.ts segue sem alocação de grupo). ' +
            'DT-USER-GROUP-ALLOCATIONS-SILENT-CALL-CLEANUP: log emitido uma vez por processo, não mais silencioso.'
        );
      }
      return [];
    }
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









