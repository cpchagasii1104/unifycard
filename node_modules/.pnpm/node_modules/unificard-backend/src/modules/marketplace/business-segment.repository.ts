// backend/src/modules/marketplace/business-segment.repository.ts
// SPRINT 81: Repository para business_segments

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { BusinessSegment, SetBusinessSegmentInput } from './business-segment.types';

interface BusinessSegmentRow {
  id: string;
  tenant_id: string;
  company_profile_tenant_id: string;
  segment_type: string;
  enabled_modules: any;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

class BusinessSegmentRepository {
  private toBusinessSegment(row: BusinessSegmentRow): BusinessSegment {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      companyProfileTenantId: row.company_profile_tenant_id,
      segmentType: row.segment_type as any,
      enabledModules: Array.isArray(row.enabled_modules) ? row.enabled_modules : [],
      metadata: row.metadata || {},
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getSegment(tenantId: string): Promise<BusinessSegment | null> {
    const row = await runQueryWithTenant<BusinessSegmentRow>(
      tenantId,
      `
      SELECT id, tenant_id, company_profile_tenant_id, segment_type,
        enabled_modules, metadata, createdAt, updatedAt
      FROM business_segments
      WHERE tenant_id = $1
      `,
      [tenantId]
    );

    if (!row) {
      return null;
    }

    return this.toBusinessSegment(row);
  }

  async setSegment(
    tenantId: string,
    companyProfileTenantId: string,
    input: SetBusinessSegmentInput
  ): Promise<BusinessSegment> {
    // Verificar se já existe
    const existing = await this.getSegment(tenantId);

    if (existing) {
      // Atualizar
      const row = await runQueryWithTenant<BusinessSegmentRow>(
        tenantId,
        `
        UPDATE business_segments
        SET segment_type = $3,
            enabled_modules = $4,
            metadata = $5,
            updatedAt = NOW()
        WHERE tenant_id = $1
        RETURNING id, tenant_id, company_profile_tenant_id, segment_type,
          enabled_modules, metadata, createdAt, updatedAt
        `,
        [
          tenantId,
          companyProfileTenantId,
          input.segmentType,
          JSON.stringify(input.enabledModules || []),
          JSON.stringify(input.metadata || {}),
        ]
      );

      if (!row) {
        throw new Error('Erro ao atualizar segmento de negócio');
      }

      return this.toBusinessSegment(row);
    } else {
      // Criar
      const row = await runQueryWithTenant<BusinessSegmentRow>(
        tenantId,
        `
        INSERT INTO business_segments (
          tenant_id, company_profile_tenant_id, segment_type,
          enabled_modules, metadata
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, tenant_id, company_profile_tenant_id, segment_type,
          enabled_modules, metadata, createdAt, updatedAt
        `,
        [
          tenantId,
          companyProfileTenantId,
          input.segmentType,
          JSON.stringify(input.enabledModules || []),
          JSON.stringify(input.metadata || {}),
        ]
      );

      if (!row) {
        throw new Error('Erro ao criar segmento de negócio');
      }

      return this.toBusinessSegment(row);
    }
  }
}

export const businessSegmentRepository = new BusinessSegmentRepository();







