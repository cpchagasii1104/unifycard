// backend/src/modules/presence/checkin-token.repository.ts
// SPRINT 94: PRESENÇA + CHECK-IN SOCIAL + BENEFÍCIOS PROMOCIONAIS

import { randomBytes } from 'crypto';
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  CheckinToken,
  PresenceContextType,
  CheckinTokenStatus,
} from './presence.types';

interface CheckinTokenRow {
  id: string;
  tenant_id: string;
  context_type: string;
  context_id: string;
  token: string;
  status: string;
  valid_from: Date | null;
  valid_to: Date | null;
  created_by_actor_id: string | null;
  created_by_user_id: string | null;
  metadata: any;
  created_at: Date;
}

class CheckinTokenRepository {
  private toCheckinToken(row: CheckinTokenRow): CheckinToken {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      contextType: row.context_type as PresenceContextType,
      contextId: row.context_id,
      token: row.token,
      status: row.status as CheckinTokenStatus,
      validFrom: row.valid_from,
      validTo: row.valid_to,
      createdByActorId: row.created_by_actor_id,
      createdByUserId: row.created_by_user_id,
      metadata: row.metadata || {},
      createdAt: row.created_at.toISOString(),
    };
  }

  async createToken(
    tenantId: string,
    contextType: PresenceContextType,
    contextId: string,
    validFrom: Date | null,
    validTo: Date | null,
    createdByActorId: string | null,
    createdByUserId: string | null,
    metadata?: Record<string, any>
  ): Promise<CheckinToken> {
    // Gerar token único (32 bytes hex = 64 caracteres)
    const token = randomBytes(32).toString('hex');

    const row = await runQueryWithTenant<CheckinTokenRow>(
      tenantId,
      `
      INSERT INTO checkin_tokens (
        tenant_id, context_type, context_id, token, status,
        valid_from, valid_to, created_by_actor_id, created_by_user_id, metadata
      )
      VALUES ($1, $2, $3, $4, 'ACTIVE', $5, $6, $7, $8, $9::jsonb)
      RETURNING id, tenant_id, context_type, context_id, token, status,
                valid_from, valid_to, created_by_actor_id, created_by_user_id, metadata, created_at
      `,
      [
        tenantId,
        contextType,
        contextId,
        token,
        validFrom,
        validTo,
        createdByActorId,
        createdByUserId,
        JSON.stringify(metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar token de check-in');
    }

    return this.toCheckinToken(row);
  }

  async getTokenByValue(tenantId: string, token: string): Promise<CheckinToken | null> {
    const row = await runQueryWithTenant<CheckinTokenRow>(
      tenantId,
      `
      SELECT id, tenant_id, context_type, context_id, token, status,
             valid_from, valid_to, created_by_actor_id, created_by_user_id, metadata, created_at
      FROM checkin_tokens
      WHERE tenant_id = $1 AND token = $2
      `,
      [tenantId, token]
    );

    return row ? this.toCheckinToken(row) : null;
  }

  async revokeToken(tenantId: string, tokenId: string): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `
      UPDATE checkin_tokens
      SET status = 'REVOKED'
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, tokenId]
    );
  }

  async listTokens(
    tenantId: string,
    contextType: PresenceContextType,
    contextId: string
  ): Promise<CheckinToken[]> {
    const rows = await runQueriesWithTenant<CheckinTokenRow>(
      tenantId,
      `
      SELECT id, tenant_id, context_type, context_id, token, status,
             valid_from, valid_to, created_by_actor_id, created_by_user_id, metadata, created_at
      FROM checkin_tokens
      WHERE tenant_id = $1 AND context_type = $2 AND context_id = $3
      ORDER BY created_at DESC
      `,
      [tenantId, contextType, contextId]
    );

    return rows.map((row) => this.toCheckinToken(row));
  }
}

export const checkinTokenRepository = new CheckinTokenRepository();







