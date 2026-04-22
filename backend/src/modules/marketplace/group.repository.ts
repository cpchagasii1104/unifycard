// backend/src/modules/marketplace/group.repository.ts
// SPRINT 74: Repository para groups
// C44 FIX: Alinhado ao schema Genesis (DECISION-0010)

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { Group, GroupFilters } from './group.types';

interface GroupRow {
  id: string;
  tenant_id: string;
  name: string;
  actor_id: string;
  metadata: any;
  created_at: Date;
}

class GroupRepository {
  private toGroup(row: GroupRow): Group {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      parentGroupId: null, // C44: coluna nao existe no schema Genesis
      createdByActorId: row.actor_id,
      createdByUserId: null, // C44: coluna nao existe no schema Genesis
      metadata: row.metadata || {},
      createdAt: row.created_at.toISOString(),
    };
  }

  async createGroup(
    tenantId: string,
    input: {
      name: string;
      parentGroupId?: string | null; // C44: ignorado (coluna nao existe)
      createdByActorId: string; // C44: mapeado para actor_id
      createdByUserId?: string | null; // C44: ignorado (coluna nao existe)
      metadata: Record<string, any>;
    }
  ): Promise<Group> {
    // C44: parentGroupId e createdByUserId ignorados (colunas nao existem no schema Genesis)
    const row = await runQueryWithTenant<GroupRow>(
      tenantId,
      `
      INSERT INTO groups (tenant_id, name, actor_id, metadata)
      VALUES ($1, $2, $3, $4::jsonb)
      RETURNING id, tenant_id, name, actor_id, metadata, created_at
      `,
      [
        tenantId,
        input.name,
        input.createdByActorId, // mapeado para actor_id
        JSON.stringify(input.metadata),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar grupo');
    }

    return this.toGroup(row);
  }

  async listGroups(tenantId: string, filters: GroupFilters = {}): Promise<Group[]> {
    // C44: filtro parentGroupId removido (coluna nao existe no schema Genesis)
    // Se filters.parentGroupId for passado, ignorar silenciosamente

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const rows = await runQueriesWithTenant<GroupRow>(
      tenantId,
      `
      SELECT id, tenant_id, name, actor_id, metadata, created_at
      FROM groups
      WHERE tenant_id = $1
      ORDER BY name ASC
      LIMIT $2 OFFSET $3
      `,
      [tenantId, limit, offset]
    );

    return rows.map((row) => this.toGroup(row));
  }

  async getGroupById(tenantId: string, groupId: string): Promise<Group | null> {
    const rows = await runQueriesWithTenant<GroupRow>(
      tenantId,
      `
      SELECT id, tenant_id, name, actor_id, metadata, created_at
      FROM groups
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, groupId]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    return this.toGroup(rows[0]);
  }
}

export const groupRepository = new GroupRepository();
