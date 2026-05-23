// backend/src/modules/automation/alert.repository.ts
// SPRINT 50: Repository para alertas

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  Alert,
  AlertSeverity,
  CreateAlertInput,
  UpdateAlertStatusInput,
  AlertFilters,
} from './automation.types';

interface AlertRow {
  id: string;
  tenant_id: string;
  type: string;
  severity: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  status: string;
  metadata: any;
  created_at: Date;
  acknowledged_at: Date | null;
  resolved_at: Date | null;
  updated_at: Date;
}

class AlertRepository {
  /**
   * Converte row para Alert
   */
  private toAlert(row: AlertRow): Alert {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      type: row.type as any,
      severity: row.severity as any,
      message: row.message,
      entityType: row.entity_type,
      entityId: row.entity_id,
      status: row.status as any,
      metadata: row.metadata || null,
      createdAt: row.created_at.toISOString(),
      acknowledgedAt: row.acknowledged_at,
      resolvedAt: row.resolved_at,
      updatedAt: row.updated_at.toISOString(),
    };
  }

  /**
   * Cria alerta
   */
  async createAlert(
    tenantId: string,
    input: CreateAlertInput
  ): Promise<Alert> {
    const row = await runQueryWithTenant<AlertRow>(
      tenantId,
      `
      INSERT INTO alerts (
        tenant_id, type, severity, message, entity_type, entity_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, tenant_id, type, severity, message, entity_type, entity_id,
                status, metadata, created_at, acknowledged_at, resolved_at, updated_at
      `,
      [
        tenantId,
        input.type,
        input.severity || 'MEDIUM',
        input.message,
        input.entityType || null,
        input.entityId || null,
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar alerta');
    }

    return this.toAlert(row);
  }

  /**
   * Atualiza status do alerta
   */
  async updateAlertStatus(
    tenantId: string,
    alertId: string,
    input: UpdateAlertStatusInput
  ): Promise<Alert> {
    const now = new Date();
    let acknowledgedAt = null;
    let resolvedAt = null;

    if (input.status === 'ack') {
      acknowledgedAt = now;
    } else if (input.status === 'resolved') {
      resolvedAt = now;
      // Se não foi ACK antes, marcar como ACK também
      const current = await this.getAlertById(tenantId, alertId);
      if (current && !current.acknowledgedAt) {
        acknowledgedAt = now;
      }
    }

    const row = await runQueryWithTenant<AlertRow>(
      tenantId,
      `
      UPDATE alerts
      SET status = $3,
          acknowledged_at = COALESCE($4, acknowledged_at),
          resolved_at = COALESCE($5, resolved_at),
          metadata = CASE
            WHEN $6 IS NOT NULL THEN metadata || jsonb_build_object('status_change_reason', $6)
            ELSE metadata
          END,
          updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2
      RETURNING id, tenant_id, type, severity, message, entity_type, entity_id,
                status, metadata, created_at, acknowledged_at, resolved_at, updated_at
      `,
      [
        tenantId,
        alertId,
        input.status,
        acknowledgedAt,
        resolvedAt,
        input.reason || null,
      ]
    );

    if (!row) {
      throw new Error(`Alerta não encontrado: ${alertId}`);
    }

    return this.toAlert(row);
  }

  /**
   * Busca alerta por ID
   */
  async getAlertById(
    tenantId: string,
    alertId: string
  ): Promise<Alert | null> {
    const row = await runQueryWithTenant<AlertRow>(
      tenantId,
      `
      SELECT id, tenant_id, type, severity, message, entity_type, entity_id,
             status, metadata, created_at, acknowledged_at, resolved_at, updated_at
      FROM alerts
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, alertId]
    );

    return row ? this.toAlert(row) : null;
  }

  /**
   * Lista alertas com filtros
   */
  async listAlerts(
    tenantId: string,
    filters: AlertFilters = {}
  ): Promise<Alert[]> {
    let query = `
      SELECT id, tenant_id, type, severity, message, entity_type, entity_id,
             status, metadata, created_at, acknowledged_at, resolved_at, updated_at
      FROM alerts
      WHERE tenant_id = $1
    `;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    // SPRINT 52: Aplicar filtros
    if (filters.type) {
      query += ` AND type = $${paramIndex}`;
      params.push(filters.type);
      paramIndex++;
    }

    if (filters.severity) {
      query += ` AND severity = $${paramIndex}`;
      params.push(filters.severity);
      paramIndex++;
    }

    if (filters.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.entityType) {
      query += ` AND entity_type = $${paramIndex}`;
      params.push(filters.entityType);
      paramIndex++;
    }

    if (filters.entityId) {
      query += ` AND entity_id = $${paramIndex}`;
      params.push(filters.entityId);
      paramIndex++;
    }

    // SPRINT 52: Paginação padronizada
    const limit = Math.min(Math.max(filters.limit || 20, 1), 100);
    query += ` ORDER BY created_at DESC LIMIT ${limit}`;

    if (filters.offset) {
      query += ` OFFSET ${filters.offset}`;
    }

    const rows = await runQueriesWithTenant<AlertRow>(tenantId, query, params);
    return rows.map((row) => this.toAlert(row));
  }

  /**
   * Conta alertas abertos (OPEN ou ACK)
   */
  async countOpenAlerts(
    tenantId: string,
    severity?: AlertSeverity
  ): Promise<number> {
    let query = `
      SELECT COUNT(*) as count
      FROM alerts
      WHERE tenant_id = $1 AND status IN ('OPEN', 'ACK')
    `;
    const params: any[] = [tenantId];

    if (severity) {
      query += ` AND severity = $2`;
      params.push(severity);
    }

    const row = await runQueryWithTenant<{ count: string }>(
      tenantId,
      query,
      params
    );

    return row ? parseInt(row.count) : 0;
  }
}

export const alertRepository = new AlertRepository();



