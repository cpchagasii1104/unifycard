// backend/src/core/pilot/pilot-invites.repository.ts
// SPRINT 14: Repository para convites do modo piloto

import { runQueryWithTenant } from '@core/database/pool';

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

    const result = await runQueryWithTenant<{
      invite_id: string;
      tenant_id: string;
      email: string;
      invited_by_user_id: string;
      status: string;
      invited_at: Date;
      accepted_at: Date | null;
      expires_at: Date;
      metadata: any;
      created_at: Date;
    }>(
      tenantId,
      `
        INSERT INTO pilot_invites (
          tenant_id, email, invited_by_user_id, status,
          expires_at, metadata
        )
        VALUES ($1, $2, $3, 'pending', $4, $5)
        RETURNING *
      `,
      [
        tenantId,
        input.email.toLowerCase().trim(),
        input.invitedByUserId,
        expiresAt,
        JSON.stringify(input.metadata || {}),
      ]
    );

    const row = result[0];
    return {
      inviteId: row.invite_id,
      tenantId: row.tenant_id,
      email: row.email,
      invitedByUserId: row.invited_by_user_id,
      status: row.status as PilotInviteStatus,
      invitedAt: row.invited_at,
      acceptedAt: row.accepted_at || undefined,
      expiresAt: row.expires_at,
      metadata: row.metadata || {},
      createdAt: row.created_at,
    };
  }

  /**
   * Busca convite pendente por email
   */
  async findPendingByEmail(
    tenantId: string,
    email: string
  ): Promise<PilotInvite | null> {
    const result = await runQueryWithTenant<{
      invite_id: string;
      tenant_id: string;
      email: string;
      invited_by_user_id: string;
      status: string;
      invited_at: Date;
      accepted_at: Date | null;
      expires_at: Date;
      metadata: any;
      created_at: Date;
    }>(
      tenantId,
      `
        SELECT *
        FROM pilot_invites
        WHERE tenant_id = $1
          AND LOWER(email) = LOWER($2)
          AND status = 'pending'
          AND expires_at > NOW()
        ORDER BY invited_at DESC
        LIMIT 1
      `,
      [tenantId, email]
    );

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      inviteId: row.invite_id,
      tenantId: row.tenant_id,
      email: row.email,
      invitedByUserId: row.invited_by_user_id,
      status: row.status as PilotInviteStatus,
      invitedAt: row.invited_at,
      acceptedAt: row.accepted_at || undefined,
      expiresAt: row.expires_at,
      metadata: row.metadata || {},
      createdAt: row.created_at,
    };
  }

  /**
   * Marca convite como aceito
   */
  async markAsAccepted(
    tenantId: string,
    email: string
  ): Promise<PilotInvite | null> {
    const result = await runQueryWithTenant<{
      invite_id: string;
      tenant_id: string;
      email: string;
      invited_by_user_id: string;
      status: string;
      invited_at: Date;
      accepted_at: Date | null;
      expires_at: Date;
      metadata: any;
      created_at: Date;
    }>(
      tenantId,
      `
        UPDATE pilot_invites
        SET status = 'accepted',
            accepted_at = NOW()
        WHERE tenant_id = $1
          AND LOWER(email) = LOWER($2)
          AND status = 'pending'
          AND expires_at > NOW()
        RETURNING *
      `,
      [tenantId, email]
    );

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      inviteId: row.invite_id,
      tenantId: row.tenant_id,
      email: row.email,
      invitedByUserId: row.invited_by_user_id,
      status: row.status as PilotInviteStatus,
      invitedAt: row.invited_at,
      acceptedAt: row.accepted_at || undefined,
      expiresAt: row.expires_at,
      metadata: row.metadata || {},
      createdAt: row.created_at,
    };
  }

  /**
   * Revoga convite
   */
  async revoke(
    tenantId: string,
    inviteId: string
  ): Promise<PilotInvite | null> {
    const result = await runQueryWithTenant<{
      invite_id: string;
      tenant_id: string;
      email: string;
      invited_by_user_id: string;
      status: string;
      invited_at: Date;
      accepted_at: Date | null;
      expires_at: Date;
      metadata: any;
      created_at: Date;
    }>(
      tenantId,
      `
        UPDATE pilot_invites
        SET status = 'revoked'
        WHERE tenant_id = $1
          AND invite_id = $2
          AND status = 'pending'
        RETURNING *
      `,
      [tenantId, inviteId]
    );

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      inviteId: row.invite_id,
      tenantId: row.tenant_id,
      email: row.email,
      invitedByUserId: row.invited_by_user_id,
      status: row.status as PilotInviteStatus,
      invitedAt: row.invited_at,
      acceptedAt: row.accepted_at || undefined,
      expiresAt: row.expires_at,
      metadata: row.metadata || {},
      createdAt: row.created_at,
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
      ORDER BY invited_at DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);

    const result = await runQueryWithTenant<{
      invite_id: string;
      tenant_id: string;
      email: string;
      invited_by_user_id: string;
      status: string;
      invited_at: Date;
      accepted_at: Date | null;
      expires_at: Date;
      metadata: any;
      created_at: Date;
    }>(tenantId, query, params);

    return result.map((row) => ({
      inviteId: row.invite_id,
      tenantId: row.tenant_id,
      email: row.email,
      invitedByUserId: row.invited_by_user_id,
      status: row.status as PilotInviteStatus,
      invitedAt: row.invited_at,
      acceptedAt: row.accepted_at || undefined,
      expiresAt: row.expires_at,
      metadata: row.metadata || {},
      createdAt: row.created_at,
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
          AND expires_at <= NOW()
        RETURNING COUNT(*) as count
      `,
      [tenantId]
    );

    return parseInt(result[0]?.count || '0', 10);
  }
}

export const pilotInvitesRepository = new PilotInvitesRepository();







