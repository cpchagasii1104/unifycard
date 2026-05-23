// backend/src/core/pilot/pilot-invites.repository.ts
// SPRINT 14: Repository para convites do modo piloto

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';

export type PilotInviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface PilotInvite {
  inviteId: string;
  tenantId: string;
  email: string;
  invitedByUserId: string;
  status: PilotInviteStatus;
  invitedAt: Date;
  acceptedAt?: Date;
  expiresAt: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface CreatePilotInviteInput {
  email: string;
  invitedByUserId: string;
  metadata?: Record<string, any>;
}

class PilotInvitesRepository {
  /**
   * Cria um novo convite
   * Verifica se já existe convite pendente para o email
   */
  async create(
    tenantId: string,
    input: CreatePilotInviteInput
  ): Promise<PilotInvite> {
    // Verificar se já existe convite pendente para este email
    const existing = await this.findPendingByEmail(tenantId, input.email);
    if (existing) {
      throw new Error('Já existe um convite pendente para este email');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 dias

    const row = await runQueryWithTenant<{
      invite_id: string;
      tenant_id: string;
      email: string;
      invited_by_user_id: string;
      status: string;
      invitedAt: Date;
      acceptedAt: Date | null;
      expiresAt: Date;
      metadata: any;
      createdAt: Date;
    }>(
      tenantId,
      {
        text: `
        INSERT INTO pilot_invites (
          tenant_id, email, invited_by_user_id, status,
          expiresAt, metadata
        )
        VALUES ($1, $2, $3, 'pending', $4, $5)
        RETURNING *
      `,
        values: [
          tenantId,
          input.email.toLowerCase().trim(),
          input.invitedByUserId,
          expiresAt,
          JSON.stringify(input.metadata || {}),
        ],
      }
    );

    if (!row) throw new Error('create: no row returned');
    return {
      inviteId: row.invite_id,
      tenantId: row.tenant_id,
      email: row.email,
      invitedByUserId: row.invited_by_user_id,
      status: row.status as PilotInviteStatus,
      invitedAt: row.invitedAt,
      acceptedAt: row.acceptedAt || undefined,
      expiresAt: row.expiresAt,
      metadata: row.metadata || {},
      createdAt: row.createdAt,
    };
  }

  /**
   * Busca convite pendente por email
   */
  async findPendingByEmail(
    tenantId: string,
    email: string
  ): Promise<PilotInvite | null> {
    const row = await runQueryWithTenant<{
      invite_id: string;
      tenant_id: string;
      email: string;
      invited_by_user_id: string;
      status: string;
      invitedAt: Date;
      acceptedAt: Date | null;
      expiresAt: Date;
      metadata: any;
      createdAt: Date;
    }>(
      tenantId,
      {
        text: `
        SELECT *
        FROM pilot_invites
        WHERE tenant_id = $1
          AND LOWER(email) = LOWER($2)
          AND status = 'pending'
          AND expiresAt > NOW()
        ORDER BY invitedAt DESC
        LIMIT 1
      `,
        values: [tenantId, email],
      }
    );

    if (!row) return null;
    return {
      inviteId: row.invite_id,
      tenantId: row.tenant_id,
      email: row.email,
      invitedByUserId: row.invited_by_user_id,
      status: row.status as PilotInviteStatus,
      invitedAt: row.invitedAt,
      acceptedAt: row.acceptedAt || undefined,
      expiresAt: row.expiresAt,
      metadata: row.metadata || {},
      createdAt: row.createdAt,
    };
  }

  /**
   * Marca convite como aceito
   */
  async markAsAccepted(
    tenantId: string,
    email: string
  ): Promise<PilotInvite | null> {
    const row = await runQueryWithTenant<{
      invite_id: string;
      tenant_id: string;
      email: string;
      invited_by_user_id: string;
      status: string;
      invitedAt: Date;
      acceptedAt: Date | null;
      expiresAt: Date;
      metadata: any;
      createdAt: Date;
    }>(
      tenantId,
      {
        text: `
        UPDATE pilot_invites
        SET status = 'accepted',
            acceptedAt = NOW()
        WHERE tenant_id = $1
          AND LOWER(email) = LOWER($2)
          AND status = 'pending'
          AND expiresAt > NOW()
        RETURNING *
      `,
        values: [tenantId, email],
      }
    );

    if (!row) return null;
    return {
      inviteId: row.invite_id,
      tenantId: row.tenant_id,
      email: row.email,
      invitedByUserId: row.invited_by_user_id,
      status: row.status as PilotInviteStatus,
      invitedAt: row.invitedAt,
      acceptedAt: row.acceptedAt || undefined,
      expiresAt: row.expiresAt,
      metadata: row.metadata || {},
      createdAt: row.createdAt,
    };
  }

  /**
   * Revoga convite
   */
  async revoke(
    tenantId: string,
    inviteId: string
  ): Promise<PilotInvite | null> {
    const row = await runQueryWithTenant<{
      invite_id: string;
      tenant_id: string;
      email: string;
      invited_by_user_id: string;
      status: string;
      invitedAt: Date;
      acceptedAt: Date | null;
      expiresAt: Date;
      metadata: any;
      createdAt: Date;
    }>(
      tenantId,
      {
        text: `
        UPDATE pilot_invites
        SET status = 'revoked'
        WHERE tenant_id = $1
          AND invite_id = $2
          AND status = 'pending'
        RETURNING *
      `,
        values: [tenantId, inviteId],
      }
    );

    if (!row) return null;
    return {
      inviteId: row.invite_id,
      tenantId: row.tenant_id,
      email: row.email,
      invitedByUserId: row.invited_by_user_id,
      status: row.status as PilotInviteStatus,
      invitedAt: row.invitedAt,
      acceptedAt: row.acceptedAt || undefined,
      expiresAt: row.expiresAt,
      metadata: row.metadata || {},
      createdAt: row.createdAt,
    };
  }

  /**
   * Lista convites
   */
  async list(
    tenantId: string,
    options?: {
      limit?: number;
      offset?: number;
      status?: PilotInviteStatus;
    }
  ): Promise<PilotInvite[]> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    let query = `
      SELECT *
      FROM pilot_invites
      WHERE tenant_id = $1
    `;
    const params: any[] = [tenantId];

    if (options?.status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(options.status);
    }

    query += `
      ORDER BY invitedAt DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);

    const rows = await runQueriesWithTenant<{
      invite_id: string;
      tenant_id: string;
      email: string;
      invited_by_user_id: string;
      status: string;
      invitedAt: Date;
      acceptedAt: Date | null;
      expiresAt: Date;
      metadata: any;
      createdAt: Date;
    }>(tenantId, query, params);

    return rows.map((row) => ({
      inviteId: row.invite_id,
      tenantId: row.tenant_id,
      email: row.email,
      invitedByUserId: row.invited_by_user_id,
      status: row.status as PilotInviteStatus,
      invitedAt: row.invitedAt,
      acceptedAt: row.acceptedAt || undefined,
      expiresAt: row.expiresAt,
      metadata: row.metadata || {},
      createdAt: row.createdAt,
    }));
  }

  /**
   * Marca convites expirados
   */
  async markExpired(tenantId: string): Promise<number> {
    const result = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
        UPDATE pilot_invites
        SET status = 'expired'
        WHERE tenant_id = $1
          AND status = 'pending'
          AND expiresAt <= NOW()
        RETURNING COUNT(*) as count
      `,
      [tenantId]
    );

    return parseInt(result?.count ?? '0', 10);
  }
}

export const pilotInvitesRepository = new PilotInvitesRepository();








