// backend/src/modules/marketplace/referral.repository.ts
// SPRINT 74: Repository para referral_codes

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { ReferralCode } from './referral.types';

interface ReferralCodeRow {
  id: string;
  tenant_id: string;
  code: string;
  owner_actor_id: string;
  group_id: string | null;
  is_active: boolean;
  created_by_actor_id: string;
  created_by_user_id: string | null;
  metadata: any;
  created_at: Date;
}

class ReferralRepository {
  private toReferralCode(row: ReferralCodeRow): ReferralCode {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      code: row.code,
      ownerActorId: row.owner_actor_id,
      groupId: row.group_id,
      isActive: row.is_active,
      createdByActorId: row.created_by_actor_id,
      createdByUserId: row.created_by_user_id,
      metadata: row.metadata || {},
      createdAt: row.created_at.toISOString(),
    };
  }

  async createCode(
    tenantId: string,
    input: {
      code: string;
      ownerActorId: string;
      groupId: string | null;
      createdByActorId: string;
      createdByUserId: string | null;
      metadata: Record<string, any>;
    }
  ): Promise<ReferralCode> {
    const row = await runQueryWithTenant<ReferralCodeRow>(
      tenantId,
      `
      INSERT INTO referral_codes (tenant_id, code, owner_actor_id, group_id, created_by_actor_id, created_by_user_id, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      RETURNING id, tenant_id, code, owner_actor_id, group_id, is_active, created_by_actor_id, created_by_user_id, metadata, created_at
      `,
      [
        tenantId,
        input.code,
        input.ownerActorId,
        input.groupId,
        input.createdByActorId,
        input.createdByUserId,
        JSON.stringify(input.metadata),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar código de indicação');
    }

    return this.toReferralCode(row);
  }

  async resolveCode(tenantId: string, code: string): Promise<ReferralCode | null> {
    const rows = await runQueriesWithTenant<ReferralCodeRow>(
      tenantId,
      `
      SELECT id, tenant_id, code, owner_actor_id, group_id, is_active, created_by_actor_id, created_by_user_id, metadata, created_at
      FROM referral_codes
      WHERE tenant_id = $1 AND code = $2 AND is_active = true
      LIMIT 1
      `,
      [tenantId, code]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    return this.toReferralCode(rows[0]);
  }
}

export const referralRepository = new ReferralRepository();








