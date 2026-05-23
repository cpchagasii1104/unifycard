// backend/src/modules/organization/organization-invite.repository.ts
// SPRINT 78: Repository para organization_invites

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { randomBytes } from 'crypto';
import type { OrganizationInvite, OrganizationInviteFilters } from './organization.types';

interface OrganizationInviteRow {
  id: string;
  tenant_id: string;
  email: string;
  role_id: string;
  invited_by_user_id: string;
  status: string;
  token: string;
  expires_at: Date;
  created_at: Date;
  accepted_at: Date | null;
}

class OrganizationInviteRepository {
  private toInvite(row: OrganizationInviteRow): OrganizationInvite {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      email: row.email,
      roleId: row.role_id,
      invitedByUserId: row.invited_by_user_id,
      status: row.status as any,
      token: row.token,
      expiresAt: row.expires_at,
      createdAt: row.created_at.toISOString(),
      acceptedAt: row.accepted_at,
    };
  }

  async createInvite(
    tenantId: string,
    input: {
      email: string;
      roleId: string;
      invitedByUserId: string;
      expiresAt: Date;
    }
  ): Promise<OrganizationInvite> {
    // Gerar token único
    const token = randomBytes(32).toString('hex');

    const row = await runQueryWithTenant<OrganizationInviteRow>(
      tenantId,
      `
      INSERT INTO organization_invites (
        tenant_id, email, role_id, invited_by_user_id, token, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, tenant_id, email, role_id, invited_by_user_id, status, token, expires_at, created_at, accepted_at
      `,
      [
        tenantId,
        input.email.toLowerCase().trim(),
        input.roleId,
        input.invitedByUserId,
        token,
        input.expiresAt,
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar convite');
    }

    return this.toInvite(row);
  }

  async getInviteById(tenantId: string, inviteId: string): Promise<OrganizationInvite | null> {
    const rows = await runQueriesWithTenant<OrganizationInviteRow>(
      tenantId,
      `
      SELECT id, tenant_id, email, role_id, invited_by_user_id, status, token, expires_at, created_at, accepted_at
      FROM organization_invites
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, inviteId]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    return this.toInvite(rows[0]);
  }

  async getInviteByToken(token: string): Promise<OrganizationInvite | null> {
    // Buscar convite por token (sem tenant específico, pois token é único globalmente)
    const { pool } = await import('@core/database/pool');
    
    const result = await pool.query<OrganizationInviteRow>(
      `
      SELECT id, tenant_id, email, role_id, invited_by_user_id, status, token, expires_at, created_at, accepted_at
      FROM organization_invites
      WHERE token = $1
      `,
      [token]
    );

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    return this.toInvite(result.rows[0]);
  }

  async listInvites(tenantId: string, filters: OrganizationInviteFilters = {}): Promise<OrganizationInvite[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const rows = await runQueriesWithTenant<OrganizationInviteRow>(
      tenantId,
      `
      SELECT id, tenant_id, email, role_id, invited_by_user_id, status, token, expires_at, created_at, accepted_at
      FROM organization_invites
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...params, limit, offset]
    );

    return rows.map((row) => this.toInvite(row));
  }

  async markAsAccepted(tenantId: string, inviteId: string): Promise<OrganizationInvite> {
    const row = await runQueryWithTenant<OrganizationInviteRow>(
      tenantId,
      `
      UPDATE organization_invites
      SET status = 'ACCEPTED',
          accepted_at = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status = 'PENDING'
      RETURNING id, tenant_id, email, role_id, invited_by_user_id, status, token, expires_at, created_at, accepted_at
      `,
      [tenantId, inviteId]
    );

    if (!row) {
      throw new Error('Convite não encontrado ou não está em PENDING');
    }

    return this.toInvite(row);
  }

  async markAsRejected(tenantId: string, inviteId: string): Promise<OrganizationInvite> {
    const row = await runQueryWithTenant<OrganizationInviteRow>(
      tenantId,
      `
      UPDATE organization_invites
      SET status = 'REJECTED'
      WHERE tenant_id = $1 AND id = $2 AND status = 'PENDING'
      RETURNING id, tenant_id, email, role_id, invited_by_user_id, status, token, expires_at, created_at, accepted_at
      `,
      [tenantId, inviteId]
    );

    if (!row) {
      throw new Error('Convite não encontrado ou não está em PENDING');
    }

    return this.toInvite(row);
  }

  async markAsExpired(tenantId: string, inviteId: string): Promise<OrganizationInvite> {
    const row = await runQueryWithTenant<OrganizationInviteRow>(
      tenantId,
      `
      UPDATE organization_invites
      SET status = 'EXPIRED'
      WHERE tenant_id = $1 AND id = $2 AND status = 'PENDING'
      RETURNING id, tenant_id, email, role_id, invited_by_user_id, status, token, expires_at, created_at, accepted_at
      `,
      [tenantId, inviteId]
    );

    if (!row) {
      throw new Error('Convite não encontrado ou não está em PENDING');
    }

    return this.toInvite(row);
  }

  async revokeInvite(tenantId: string, inviteId: string): Promise<OrganizationInvite> {
    // Marcar como REJECTED se estiver PENDING
    const row = await runQueryWithTenant<OrganizationInviteRow>(
      tenantId,
      `
      UPDATE organization_invites
      SET status = 'REJECTED'
      WHERE tenant_id = $1 AND id = $2 AND status = 'PENDING'
      RETURNING id, tenant_id, email, role_id, invited_by_user_id, status, token, expires_at, created_at, accepted_at
      `,
      [tenantId, inviteId]
    );

    if (!row) {
      throw new Error('Convite não encontrado ou não pode ser revogado');
    }

    return this.toInvite(row);
  }
}

export const organizationInviteRepository = new OrganizationInviteRepository();



