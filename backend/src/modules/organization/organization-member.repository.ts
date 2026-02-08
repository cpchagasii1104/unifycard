// backend/src/modules/organization/organization-member.repository.ts
// SPRINT 78: Repository para organization_members

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { OrganizationMember, OrganizationMemberFilters } from './organization.types';

interface OrganizationMemberRow {
  id: string;
  tenant_id: string;
  actor_id: string;
  user_id: string;
  role_id: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

class OrganizationMemberRepository {
  private toMember(row: OrganizationMemberRow): OrganizationMember {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      actorId: row.actor_id,
      userId: row.user_id,
      roleId: row.role_id,
      status: row.status as any,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async createMember(
    tenantId: string,
    input: {
      actorId: string;
      userId: string;
      roleId: string;
    }
  ): Promise<OrganizationMember> {
    const row = await runQueryWithTenant<OrganizationMemberRow>(
      tenantId,
      `
      INSERT INTO organization_members (
        tenant_id, actor_id, user_id, role_id, status
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (tenant_id, actor_id, user_id) DO UPDATE
      SET role_id = EXCLUDED.role_id,
          status = 'ACTIVE',
          updatedAt = NOW()
      RETURNING id, tenant_id, actor_id, user_id, role_id, status, createdAt, updatedAt
      `,
      [tenantId, input.actorId, input.userId, input.roleId, 'ACTIVE']
    );

    if (!row) {
      throw new Error('Erro ao criar membro');
    }

    return this.toMember(row);
  }

  async getMemberById(tenantId: string, memberId: string): Promise<OrganizationMember | null> {
    const rows = await runQueriesWithTenant<OrganizationMemberRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, user_id, role_id, status, createdAt, updatedAt
      FROM organization_members
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, memberId]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    return this.toMember(rows[0]);
  }

  async getMemberByUser(tenantId: string, userId: string, actorId: string): Promise<OrganizationMember | null> {
    const rows = await runQueriesWithTenant<OrganizationMemberRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, user_id, role_id, status, createdAt, updatedAt
      FROM organization_members
      WHERE tenant_id = $1 AND user_id = $2 AND actor_id = $3
      `,
      [tenantId, userId, actorId]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    return this.toMember(rows[0]);
  }

  async listMembers(tenantId: string, filters: OrganizationMemberFilters = {}): Promise<OrganizationMember[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.roleKey) {
      // Buscar role_id pelo role_key
      conditions.push(`role_id IN (
        SELECT id FROM organization_roles WHERE tenant_id = $1 AND role_key = $${paramIndex}
      )`);
      params.push(filters.roleKey);
      paramIndex++;
    }

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const rows = await runQueriesWithTenant<OrganizationMemberRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, user_id, role_id, status, createdAt, updatedAt
      FROM organization_members
      WHERE ${conditions.join(' AND ')}
      ORDER BY createdAt DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...params, limit, offset]
    );

    return rows.map((row) => this.toMember(row));
  }

  async changeRole(tenantId: string, memberId: string, roleId: string): Promise<OrganizationMember> {
    const row = await runQueryWithTenant<OrganizationMemberRow>(
      tenantId,
      `
      UPDATE organization_members
      SET role_id = $3,
          updatedAt = NOW()
      WHERE tenant_id = $1 AND id = $2
      RETURNING id, tenant_id, actor_id, user_id, role_id, status, createdAt, updatedAt
      `,
      [tenantId, memberId, roleId]
    );

    if (!row) {
      throw new Error('Membro não encontrado');
    }

    return this.toMember(row);
  }

  async removeMember(tenantId: string, memberId: string): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `
      DELETE FROM organization_members
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, memberId]
    );
  }

  async suspendMember(tenantId: string, memberId: string): Promise<OrganizationMember> {
    const row = await runQueryWithTenant<OrganizationMemberRow>(
      tenantId,
      `
      UPDATE organization_members
      SET status = 'SUSPENDED',
          updatedAt = NOW()
      WHERE tenant_id = $1 AND id = $2
      RETURNING id, tenant_id, actor_id, user_id, role_id, status, createdAt, updatedAt
      `,
      [tenantId, memberId]
    );

    if (!row) {
      throw new Error('Membro não encontrado');
    }

    return this.toMember(row);
  }
}

export const organizationMemberRepository = new OrganizationMemberRepository();







