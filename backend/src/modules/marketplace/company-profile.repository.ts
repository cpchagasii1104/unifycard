// backend/src/modules/marketplace/company-profile.repository.ts
// SPRINT 75: Repository para company_profiles

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { CompanyProfile, SetCompanyProfileInput } from './company-profile.types';

interface CompanyProfileRow {
  tenant_id: string;
  erp_profile: string;
  tax_regime: string;
  created_by_actor_id: string;
  created_by_user_id: string | null;
  updated_by_actor_id: string | null;
  updated_by_user_id: string | null;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

class CompanyProfileRepository {
  private toCompanyProfile(row: CompanyProfileRow): CompanyProfile {
    return {
      tenantId: row.tenant_id,
      erpProfile: row.erp_profile as any,
      taxRegime: row.tax_regime as any,
      createdByActorId: row.created_by_actor_id,
      createdByUserId: row.created_by_user_id,
      updatedByActorId: row.updated_by_actor_id,
      updatedByUserId: row.updated_by_user_id,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getProfile(tenantId: string): Promise<CompanyProfile | null> {
    const rows = await runQueriesWithTenant<CompanyProfileRow>(
      tenantId,
      `
      SELECT tenant_id, erp_profile, tax_regime,
             created_by_actor_id, created_by_user_id,
             updated_by_actor_id, updated_by_user_id,
             metadata, created_at, updated_at
      FROM company_profiles
      WHERE tenant_id = $1
      `,
      [tenantId]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    return this.toCompanyProfile(rows[0]);
  }

  async setProfile(
    tenantId: string,
    input: SetCompanyProfileInput,
    createdByActorId: string,
    createdByUserId: string | null,
    updatedByActorId: string,
    updatedByUserId: string | null
  ): Promise<CompanyProfile> {
    // Verificar se já existe
    const existing = await this.getProfile(tenantId);

    let row: CompanyProfileRow;
    if (existing) {
      // Atualizar
      const rows = await runQueriesWithTenant<CompanyProfileRow>(
        tenantId,
        `
        UPDATE company_profiles
        SET erp_profile = $2,
            tax_regime = $3,
            updated_by_actor_id = $4,
            updated_by_user_id = $5,
            metadata = $6::jsonb,
            updated_at = NOW()
        WHERE tenant_id = $1
        RETURNING tenant_id, erp_profile, tax_regime,
                  created_by_actor_id, created_by_user_id,
                  updated_by_actor_id, updated_by_user_id,
                  metadata, created_at, updated_at
        `,
        [
          tenantId,
          input.erpProfile,
          input.taxRegime,
          updatedByActorId,
          updatedByUserId,
          JSON.stringify(input.metadata || {}),
        ]
      );
      row = rows[0];
    } else {
      // Criar
      const rows = await runQueriesWithTenant<CompanyProfileRow>(
        tenantId,
        `
        INSERT INTO company_profiles (tenant_id, erp_profile, tax_regime, created_by_actor_id, created_by_user_id, metadata)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb)
        RETURNING tenant_id, erp_profile, tax_regime,
                  created_by_actor_id, created_by_user_id,
                  updated_by_actor_id, updated_by_user_id,
                  metadata, created_at, updated_at
        `,
        [
          tenantId,
          input.erpProfile,
          input.taxRegime,
          createdByActorId,
          createdByUserId,
          JSON.stringify(input.metadata || {}),
        ]
      );
      row = rows[0];
    }

    if (!row) {
      throw new Error('Erro ao definir perfil da empresa');
    }

    return this.toCompanyProfile(row);
  }
}

export const companyProfileRepository = new CompanyProfileRepository();






