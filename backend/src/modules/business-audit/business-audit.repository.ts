// backend/src/modules/business-audit/business-audit.repository.ts
// Repository para Logs de Auditoria de Negócio
// 🔴 BLINDAGEM: Logs são IMUTÁVEIS (append-only)

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  BusinessAuditLog,
  CreateBusinessAuditLogInput,
  BusinessAuditLogFilters,
} from './business-audit.types';

interface BusinessAuditLogRow {
  log_id: string;
  tenant_id: string;
  action: string;
  actor_id: string;
  user_id: string | null;
  context_type: string;
  context_id: string;
  metadata: any;
  created_at: Date;
}

class BusinessAuditLogRepository {
  private toLog(row: BusinessAuditLogRow): BusinessAuditLog {
    return {
      logId: row.log_id,
      tenantId: row.tenant_id,
      action: row.action as any,
      actorId: row.actor_id,
      userId: row.user_id,
      contextType: row.context_type as any,
      contextId: row.context_id,
      metadata: row.metadata || {},
      createdAt: row.created_at.toISOString(),
    };
  }

  /**
   * Criar log de auditoria
   * 🔴 BLINDAGEM: Log é imutável após criação
   */
  async create(tenantId: string, input: CreateBusinessAuditLogInput): Promise<BusinessAuditLog> {
    const row = await runQueryWithTenant<BusinessAuditLogRow>(
      tenantId,
      `
      INSERT INTO business_audit_logs (
        tenant_id, action, actor_id, user_id, context_type, context_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      RETURNING log_id, tenant_id, action, actor_id, user_id, context_type, context_id,
                metadata, created_at
      `,
      [
        tenantId,
        input.action,
        input.actorId,
        input.userId || null,
        input.contextType,
        input.contextId,
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Falha ao criar log de auditoria');
    }

    return this.toLog(row);
  }

  /**
   * Buscar log por ID
   */
  async findById(tenantId: string, logId: string): Promise<BusinessAuditLog | null> {
    const row = await runQueryWithTenant<BusinessAuditLogRow>(
      tenantId,
      `
      SELECT log_id, tenant_id, action, actor_id, user_id, context_type, context_id,
             metadata, created_at
      FROM business_audit_logs
      WHERE tenant_id = $1 AND log_id = $2
      `,
      [tenantId, logId]
    );

    return row ? this.toLog(row) : null;
  }

  /**
   * Listar logs com filtros
   * 🔴 BLINDAGEM: Ordenação apenas por createdAt DESC (mais recente primeiro)
   */
  async find(
    tenantId: string,
    filters: BusinessAuditLogFilters = {}
  ): Promise<{ logs: BusinessAuditLog[]; totalCents: number }> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.actorId) {
      conditions.push(`actor_id = $${paramIndex++}`);
      params.push(filters.actorId);
    }

    if (filters.action) {
      conditions.push(`action = $${paramIndex++}`);
      params.push(filters.action);
    }

    if (filters.contextType) {
      conditions.push(`context_type = $${paramIndex++}`);
      params.push(filters.contextType);
    }

    if (filters.contextId) {
      conditions.push(`context_id = $${paramIndex++}`);
      params.push(filters.contextId);
    }

    if (filters.startDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(filters.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Contar total
    const countRow = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
      SELECT COUNT(*) as count
      FROM business_audit_logs
      ${whereClause}
      `,
      params
    );

    const total = parseInt(countRow?.count || '0', 10);

    // Buscar logs
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const rows = await runQueriesWithTenant<BusinessAuditLogRow>(
      tenantId,
      {
        text: `
      SELECT log_id, tenant_id, action, actor_id, user_id, context_type, context_id,
             metadata, created_at
      FROM business_audit_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `,
        values: [...params, limit, offset],
      }
    );

    return {
      logs: rows.map((row) => this.toLog(row)),
      totalCents: total,
    };
  }
}

export const businessAuditLogRepository = new BusinessAuditLogRepository();







