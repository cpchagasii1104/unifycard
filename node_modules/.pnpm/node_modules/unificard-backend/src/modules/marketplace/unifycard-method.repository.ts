// backend/src/modules/marketplace/unifycard-method.repository.ts
// SPRINT 82: Repository para unifycard_payment_methods

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { UnifyCardMethod, CreateUnifyCardMethodInput } from './unifycard-method.types';

interface UnifyCardMethodRow {
  id: string;
  tenant_id: string;
  method_type: string;
  provider: string;
  fee_percentage: number;
  settlement_delay_days: number;
  metadata: any;
  createdAt: Date;
}

class UnifyCardMethodRepository {
  private toUnifyCardMethod(row: UnifyCardMethodRow): UnifyCardMethod {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      methodType: row.method_type as any,
      provider: row.provider,
      feePercentage: parseFloat(row.fee_percentage.toString()),
      settlementDelayDays: row.settlement_delay_days,
      metadata: row.metadata || {},
      createdAt: row.createdAt.toISOString(),
    };
  }

  async createMethod(
    tenantId: string,
    input: CreateUnifyCardMethodInput
  ): Promise<UnifyCardMethod> {
    // Verificar se já existe método deste tipo
    const existing = await this.getMethodByType(tenantId, input.methodType);
    if (existing) {
      throw new Error(`Método ${input.methodType} já existe para este tenant`);
    }

    const row = await runQueryWithTenant<UnifyCardMethodRow>(
      tenantId,
      `
      INSERT INTO unifycard_payment_methods (
        tenant_id, method_type, provider, fee_percentage, settlement_delay_days, metadata
      )
      VALUES ($1, $2, 'UNIFYCARD', $3, $4, $5)
      RETURNING id, tenant_id, method_type, provider, fee_percentage, settlement_delay_days, metadata, createdAt
      `,
      [
        tenantId,
        input.methodType,
        input.feePercentage ?? 0,
        input.settlementDelayDays ?? 0,
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar método UnifyCard');
    }

    return this.toUnifyCardMethod(row);
  }

  async listMethods(tenantId: string): Promise<UnifyCardMethod[]> {
    const rows = await runQueriesWithTenant<UnifyCardMethodRow>(
      tenantId,
      `
      SELECT id, tenant_id, method_type, provider, fee_percentage, settlement_delay_days, metadata, createdAt
      FROM unifycard_payment_methods
      WHERE tenant_id = $1
      ORDER BY method_type ASC
      `,
      [tenantId]
    );

    return rows.map((row) => this.toUnifyCardMethod(row));
  }

  async getMethodByType(tenantId: string, methodType: string): Promise<UnifyCardMethod | null> {
    const row = await runQueryWithTenant<UnifyCardMethodRow>(
      tenantId,
      `
      SELECT id, tenant_id, method_type, provider, fee_percentage, settlement_delay_days, metadata, createdAt
      FROM unifycard_payment_methods
      WHERE tenant_id = $1 AND method_type = $2
      `,
      [tenantId, methodType]
    );

    if (!row) {
      return null;
    }

    return this.toUnifyCardMethod(row);
  }
}

export const unifyCardMethodRepository = new UnifyCardMethodRepository();







