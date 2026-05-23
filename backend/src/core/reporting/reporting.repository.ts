// src/core/reporting/reporting.repository.ts
// Repository para acesso ao banco de dados conforme REPORTING_DATA_MODEL.md

import { pool } from '@core/database/pool';
import type { Report, ReportRow } from './models/Report';
import type { ReportEvent, ReportEventRow } from './models/ReportEvent';
import type { RiskFlag, RiskFlagRow } from './models/RiskFlag';
import { randomUUID } from 'crypto';

class ReportingRepository {
  /**
   * Criar nova denúncia
   */
  async createReport(tenantId: string, report: Omit<Report, 'id' | 'createdAt' | 'updatedAt'>): Promise<Report> {
    const id = randomUUID();
    const now = new Date();

    const result = await pool.query<ReportRow>(
      `
      INSERT INTO reports (
        id, reporter_user_id, target_type, target_id, module, tenant_id,
        reason_code, description, status, severity, risk_score,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
      `,
      [
        id,
        report.reporter_user_id,
        report.target_type,
        report.target_id,
        report.module,
        tenantId,
        report.reason_code,
        report.description || null,
        report.status,
        report.severity,
        report.risk_score || null,
        now,
        now,
      ]
    );

    return this.toReport(result.rows[0]);
  }

  /**
   * Buscar denúncia por ID
   */
  async findReportById(tenantId: string, reportId: string): Promise<Report | null> {
    const result = await pool.query<ReportRow>(
      `
      SELECT *
      FROM reports
      WHERE id = $1 AND tenant_id = $2
      `,
      [reportId, tenantId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.toReport(result.rows[0]);
  }

  /**
   * Listar denúncias do usuário
   */
  async findReportsByReporter(tenantId: string, reporterUserId: string, limit: number = 50, offset: number = 0): Promise<Report[]> {
    const result = await pool.query<ReportRow>(
      `
      SELECT *
      FROM reports
      WHERE tenant_id = $1 AND reporter_user_id = $2
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
      `,
      [tenantId, reporterUserId, limit, offset]
    );

    return result.rows.map((row) => this.toReport(row));
  }

  /**
   * Listar denúncias (auditoria) com filtros
   */
  async findReports(
    tenantId: string,
    filters: {
      module?: string;
      status?: string;
      target_type?: string;
      severity?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ reports: Report[]; totalCents: number }> {
    const { module, status, target_type, severity, limit = 50, offset = 0 } = filters;

    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (module) {
      conditions.push(`module = $${paramIndex}`);
      params.push(module);
      paramIndex++;
    }

    if (status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (target_type) {
      conditions.push(`target_type = $${paramIndex}`);
      params.push(target_type);
      paramIndex++;
    }

    if (severity) {
      conditions.push(`severity = $${paramIndex}`);
      params.push(severity);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Contar total
    const countResult = await pool.query<{ count: string }>(
      `
      SELECT COUNT(*) as count
      FROM reports
      WHERE ${whereClause}
      `,
      params
    );

    const total = parseInt(countResult.rows[0].count, 10);

    // Buscar reports
    params.push(limit, offset);
    const result = await pool.query<ReportRow>(
      `
      SELECT *
      FROM reports
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      params
    );

    return {
      reports: result.rows.map((row) => this.toReport(row)),
      totalCents: total,
    };
  }

  /**
   * Atualizar status da denúncia
   */
  async updateReportStatus(
    tenantId: string,
    reportId: string,
    status: string,
    resolvedAt?: Date
  ): Promise<Report | null> {
    const now = new Date();

    const result = await pool.query<ReportRow>(
      `
      UPDATE reports
      SET status = $1, updated_at = $2, resolved_at = $3
      WHERE id = $4 AND tenant_id = $5
      RETURNING *
      `,
      [status, now, resolvedAt || null, reportId, tenantId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.toReport(result.rows[0]);
  }

  /**
   * Criar evento de audit trail
   */
  async createReportEvent(event: Omit<ReportEvent, 'id' | 'createdAt'>): Promise<ReportEvent> {
    const id = randomUUID();
    const now = new Date();

    const result = await pool.query<ReportEventRow>(
      `
      INSERT INTO report_events (
        id, report_id, actor_type, actor_id, event_type, metadata, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [
        id,
        event.report_id,
        event.actor_type,
        event.actor_id || null,
        event.event_type,
        event.metadata ? JSON.stringify(event.metadata) : null,
        now,
      ]
    );

    return this.toReportEvent(result.rows[0]);
  }

  /**
   * Buscar eventos de uma denúncia
   */
  async findReportEvents(reportId: string): Promise<ReportEvent[]> {
    const result = await pool.query<ReportEventRow>(
      `
      SELECT *
      FROM report_events
      WHERE report_id = $1
      ORDER BY created_at ASC
      `,
      [reportId]
    );

    return result.rows.map((row) => this.toReportEvent(row));
  }

  /**
   * Buscar denúncias por target (para cálculo de risk score)
   */
  async findReportsByTarget(
    tenantId: string,
    targetType: string,
    targetId: string,
    module?: string
  ): Promise<Report[]> {
    const conditions: string[] = ['tenant_id = $1', 'target_type = $2', 'target_id = $3'];
    const params: any[] = [tenantId, targetType, targetId];

    if (module) {
      conditions.push('module = $4');
      params.push(module);
    }

    const whereClause = conditions.join(' AND ');

    const result = await pool.query<ReportRow>(
      `
      SELECT *
      FROM reports
      WHERE ${whereClause}
      ORDER BY created_at DESC
      `,
      params
    );

    return result.rows.map((row) => this.toReport(row));
  }

  /**
   * Buscar ou criar risk flag
   */
  async upsertRiskFlag(flag: Omit<RiskFlag, 'id' | 'createdAt'>): Promise<RiskFlag> {
    const now = new Date();

    // Tentar buscar existente
    const existing = await pool.query<RiskFlagRow>(
      `
      SELECT *
      FROM risk_flags
      WHERE target_type = $1 AND target_id = $2 AND module = $3 AND tenant_id = $4
      `,
      [flag.target_type, flag.target_id, flag.module, flag.tenant_id]
    );

    if (existing.rows.length > 0) {
      // Atualizar existente
      const result = await pool.query<RiskFlagRow>(
        `
        UPDATE risk_flags
        SET risk_level = $1, risk_score = $2, last_evaluated_at = $3
        WHERE id = $4
        RETURNING *
        `,
        [flag.risk_level, flag.risk_score, now, existing.rows[0].id]
      );

      return this.toRiskFlag(result.rows[0]);
    }

    // Criar novo
    const id = randomUUID();
    const result = await pool.query<RiskFlagRow>(
      `
      INSERT INTO risk_flags (
        id, target_type, target_id, module, tenant_id,
        risk_level, risk_score, last_evaluated_at, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
      `,
      [
        id,
        flag.target_type,
        flag.target_id,
        flag.module,
        flag.tenant_id,
        flag.risk_level,
        flag.risk_score,
        now,
        now,
      ]
    );

    return this.toRiskFlag(result.rows[0]);
  }

  /**
   * Buscar risk flag por target
   */
  async findRiskFlag(
    tenantId: string,
    targetType: string,
    targetId: string,
    module: string
  ): Promise<RiskFlag | null> {
    const result = await pool.query<RiskFlagRow>(
      `
      SELECT *
      FROM risk_flags
      WHERE tenant_id = $1 AND target_type = $2 AND target_id = $3 AND module = $4
      `,
      [tenantId, targetType, targetId, module]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.toRiskFlag(result.rows[0]);
  }

  // Helpers de conversão
  private toReport(row: ReportRow): Report {
    return {
      id: row.id,
      reporter_user_id: row.reporter_user_id,
      target_type: row.target_type as any,
      target_id: row.target_id,
      module: row.module,
      tenant_id: row.tenant_id,
      reason_code: row.reason_code as any,
      description: row.description || undefined,
      status: row.status as any,
      severity: row.severity as any,
      risk_score: row.risk_score || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      resolvedAt: row.resolved_at || undefined,
    };
  }

  private toReportEvent(row: ReportEventRow): ReportEvent {
    return {
      id: row.id,
      report_id: row.report_id,
      actor_type: row.actor_type as any,
      actor_id: row.actor_id || undefined,
      event_type: row.event_type as any,
      metadata: row.metadata || undefined,
      createdAt: row.created_at,
    };
  }

  private toRiskFlag(row: RiskFlagRow): RiskFlag {
    return {
      id: row.id,
      target_type: row.target_type,
      target_id: row.target_id,
      module: row.module,
      tenant_id: row.tenant_id,
      risk_level: row.risk_level as any,
      risk_score: row.risk_score,
      last_evaluatedAt: row.last_evaluated_at,
      createdAt: row.created_at,
    };
  }
}

export const reportingRepository = new ReportingRepository();








