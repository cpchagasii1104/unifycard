// backend/src/modules/marketplace/tax-profile.repository.ts
// SPRINT 80: Repository para tax_profiles

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { TaxProfile, SetTaxProfileInput } from './tax-profile.types';

interface TaxProfileRow {
  id: string;
  tenant_id: string;
  company_profile_tenant_id: string;
  tax_regime: string;
  state: string | null;
  city: string | null;
  is_icms_contributor: boolean;
  is_service_provider: boolean;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

class TaxProfileRepository {
  private toTaxProfile(row: TaxProfileRow): TaxProfile {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      companyProfileTenantId: row.company_profile_tenant_id,
      taxRegime: row.tax_regime as any,
      state: row.state,
      city: row.city,
      isIcmsContributor: row.is_icms_contributor,
      isServiceProvider: row.is_service_provider,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getTaxProfile(tenantId: string): Promise<TaxProfile | null> {
    const row = await runQueryWithTenant<TaxProfileRow>(
      tenantId,
      `
      SELECT id, tenant_id, company_profile_tenant_id, tax_regime,
        state, city, is_icms_contributor, is_service_provider,
        metadata, created_at, updated_at
      FROM tax_profiles
      WHERE tenant_id = $1
      `,
      [tenantId]
    );

    if (!row) {
      return null;
    }

    return this.toTaxProfile(row);
  }

  async setTaxProfile(
    tenantId: string,
    companyProfileTenantId: string,
    input: SetTaxProfileInput
  ): Promise<TaxProfile> {
    // Verificar se já existe
    const existing = await this.getTaxProfile(tenantId);

    if (existing) {
      // Atualizar
      const row = await runQueryWithTenant<TaxProfileRow>(
        tenantId,
        `
        UPDATE tax_profiles
        SET tax_regime = $3,
            state = $4,
            city = $5,
            is_icms_contributor = $6,
            is_service_provider = $7,
            metadata = $8,
            updated_at = NOW()
        WHERE tenant_id = $1
        RETURNING id, tenant_id, company_profile_tenant_id, tax_regime,
          state, city, is_icms_contributor, is_service_provider,
          metadata, created_at, updated_at
        `,
        [
          tenantId,
          companyProfileTenantId,
          input.taxRegime,
          input.state || null,
          input.city || null,
          input.isIcmsContributor ?? false,
          input.isServiceProvider ?? false,
          JSON.stringify(input.metadata || {}),
        ]
      );

      if (!row) {
        throw new Error('Erro ao atualizar perfil fiscal');
      }

      return this.toTaxProfile(row);
    } else {
      // Criar
      const row = await runQueryWithTenant<TaxProfileRow>(
        tenantId,
        `
        INSERT INTO tax_profiles (
          tenant_id, company_profile_tenant_id, tax_regime,
          state, city, is_icms_contributor, is_service_provider, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, tenant_id, company_profile_tenant_id, tax_regime,
          state, city, is_icms_contributor, is_service_provider,
          metadata, created_at, updated_at
        `,
        [
          tenantId,
          companyProfileTenantId,
          input.taxRegime,
          input.state || null,
          input.city || null,
          input.isIcmsContributor ?? false,
          input.isServiceProvider ?? false,
          JSON.stringify(input.metadata || {}),
        ]
      );

      if (!row) {
        throw new Error('Erro ao criar perfil fiscal');
      }

      return this.toTaxProfile(row);
    }
  }
}

export const taxProfileRepository = new TaxProfileRepository();





