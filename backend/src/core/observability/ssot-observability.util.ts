// backend/src/core/observability/ssot-observability.util.ts
// Util de observabilidade para violações de SSOT (repository + service podem usar)
// REGRA: *.util.ts pode ser importado por repository e service (evita repository → service)

import { pool } from '@core/database/pool';

export type SSOTViolationType = 'SSOT_VIOLATION' | 'SSOT_SMELL' | 'LEGACY_CALL';

interface SSOTViolationDetails {
  [key: string]: any;
}

class SSOTObservabilityUtil {
  async recordViolation(
    type: SSOTViolationType,
    options: {
      tenantId?: string | null;
      context?: string | null;
      details?: SSOTViolationDetails;
    }
  ): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO ssot_violations (type, tenant_id, context, details, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [
          type,
          options.tenantId ?? null,
          options.context ?? null,
          JSON.stringify(options.details ?? {}),
        ]
      );
    } catch (error) {
      console.error('[SSOTObservability] Erro ao registrar violação:', error);
    }
  }

  async getMetrics(options?: {
    tenantId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    counts: Record<SSOTViolationType, number>;
    recent: Array<{
      id: string;
      type: SSOTViolationType;
      tenantId: string | null;
      context: string | null;
      details: any;
      createdAt: Date;
    }>;
  }> {
    let query = `
      SELECT type, COUNT(*) as count
      FROM ssot_violations
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.tenantId) {
      query += ` AND tenant_id = $${paramIndex}`;
      params.push(options.tenantId);
      paramIndex++;
    }
    if (options?.startDate) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(options.startDate);
      paramIndex++;
    }
    if (options?.endDate) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(options.endDate);
      paramIndex++;
    }
    query += ` GROUP BY type`;

    const countsResult = await pool.query(query, params);
    const counts: Record<SSOTViolationType, number> = {
      SSOT_VIOLATION: 0,
      SSOT_SMELL: 0,
      LEGACY_CALL: 0,
    };
    countsResult.rows.forEach((row: any) => {
      counts[row.type as SSOTViolationType] = parseInt(row.count, 10);
    });

    let recentQuery = `
      SELECT id, type, tenant_id, context, details, created_at
      FROM ssot_violations
      WHERE 1=1
    `;
    const recentParams: any[] = [];
    let recentParamIndex = 1;
    if (options?.tenantId) {
      recentQuery += ` AND tenant_id = $${recentParamIndex}`;
      recentParams.push(options.tenantId);
      recentParamIndex++;
    }
    if (options?.startDate) {
      recentQuery += ` AND created_at >= $${recentParamIndex}`;
      recentParams.push(options.startDate);
      recentParamIndex++;
    }
    if (options?.endDate) {
      recentQuery += ` AND created_at <= $${recentParamIndex}`;
      recentParams.push(options.endDate);
      recentParamIndex++;
    }
    recentQuery += ` ORDER BY created_at DESC LIMIT 50`;

    const recentResult = await pool.query(recentQuery, recentParams);
    const recent = recentResult.rows.map((row: any) => ({
      id: row.id,
      type: row.type as SSOTViolationType,
      tenantId: row.tenant_id,
      context: row.context,
      details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
      createdAt: row.created_at,
    }));

    return { counts, recent };
  }
}

export const ssotObservabilityUtil = new SSOTObservabilityUtil();
/** @deprecated Use ssotObservabilityUtil */
export const ssotObservabilityService = ssotObservabilityUtil;