// backend/src/modules/marketplace/group.repository.ts
// SPRINT 74: Repository para groups

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { Group, GroupFilters } from './group.types';

interface GroupRow {
  id: string;
  tenant_id: string;
  name: string;
  parent_group_id: string | null;
  created_by_actor_id: string;
  created_by_user_id: string | null;
  metadata: any;
  created_at: Date;
}

class GroupRepository {
  private toGroup(row: GroupRow): Group {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      parentGroupId: row.parent_group_id,
      createdByActorId: row.created_by_actor_id,
      createdByUserId: row.created_by_user_id,
      metadata: row.metadata || {},
      createdAt: row.created_at,
    };
  }

  async createGroup(
    tenantId: string,
    input: {
      name: string;
      parentGroupId: string | null;
      createdByActorId: string;
      createdByUserId: string | null;
      metadata: Record<string, any>;
    }
  ): Promise<Group> {
    const row = await runQueryWithTenant<GroupRow>(
      tenantId,
      `
      INSERT INTO groups (tenant_id, name, parent_group_id, created_by_actor_id, created_by_user_id, metadata)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      RETURNING id, tenant_id, name, parent_group_id, created_by_actor_id, created_by_user_id, metadata, created_at
      `,
      [
        tenantId,
        input.name,
        input.parentGroupId,
        input.createdByActorId,
        input.createdByUserId,
        JSON.stringify(input.metadata),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar grupo');
    }

    return this.toGroup(row);
  }

  async listGroups(tenantId: string, filters: GroupFilters = {}): Promise<Group[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.parentGroupId !== undefined) {
      if (filters.parentGroupId === null) {
        conditions.push('parent_group_id IS NULL');
      } else {
        conditions.push(`parent_group_id = $${paramIndex}`);
        params.push(filters.parentGroupId);
        paramIndex++;
      }
    }

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const rows = await runQueriesWithTenant<GroupRow>(
      tenantId,
      `
      SELECT id, tenant_id, name, parent_group_id, created_by_actor_id, created_by_user_id, metadata, created_at
      FROM groups
      WHERE ${conditions.join(' AND ')}
      ORDER BY name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...params, limit, offset]
    );

    return rows.map((row) => this.toGroup(row));
  }

  async getGroupById(tenantId: string, groupId: string): Promise<Group | null> {
    const rows = await runQueriesWithTenant<GroupRow>(
      tenantId,
      `
      SELECT id, tenant_id, name, parent_group_id, created_by_actor_id, created_by_user_id, metadata, created_at
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






