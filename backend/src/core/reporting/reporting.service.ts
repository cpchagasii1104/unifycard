// src/core/reporting/reporting.service.ts
// Service de lógica de negócio do Reporting Core

import { reportingRepository } from './reporting.repository';
import { riskScoringEngine } from './ai/RiskScoringEngine';
import { reportingPolicy } from './policies/ReportingPolicy';
import type { Report, ReportStatus, ReportTargetType, ReportReasonCode } from './models/Report';
import type { ReportEvent, ReportActorType, ReportEventType } from './models/ReportEvent';

export interface CreateReportInput {
  reporter_user_id: string;
  target_type: ReportTargetType;
  target_id: string;
  module: string;
  reason_code: ReportReasonCode;
  description?: string;
}

export interface UpdateReportStatusInput {
  status: ReportStatus;
  comment: string; // Obrigatório ao encerrar
  actor_type: ReportActorType;
  actor_id?: string;
}

class ReportingService {
  /**
   * Criar nova denúncia
   * Conforme REPORTING_CORE.md:
   * - status inicial = OPEN
   * - severity inicial = LOW
   * - criar evento REPORT_CREATED
   * - calcular risk score
   */
  async createReport(tenantId: string, input: CreateReportInput): Promise<Report> {
    // Verificar rate limit
    const policyCheck = await reportingPolicy.canCreateReport(tenantId, input.reporter_user_id);
    if (!policyCheck.allowed) {
      throw new Error(policyCheck.reason || 'Não é possível criar denúncia no momento');
    }

    // Criar report
    const report = await reportingRepository.createReport(tenantId, {
      reporter_user_id: input.reporter_user_id,
      target_type: input.target_type,
      target_id: input.target_id,
      module: input.module,
      tenant_id: tenantId,
      reason_code: input.reason_code,
      description: input.description,
      status: 'OPEN', // Status inicial
      severity: 'LOW', // Severidade inicial
    });

    // Criar evento de audit trail
    await reportingRepository.createReportEvent({
      report_id: report.id,
      actor_type: 'USER',
      actor_id: input.reporter_user_id,
      event_type: 'REPORT_CREATED',
      metadata: {
        target_type: input.target_type,
        target_id: input.target_id,
        module: input.module,
        reason_code: input.reason_code,
      },
    });

    // Calcular e atualizar risk score
    await riskScoringEngine.updateRiskFlag(
      tenantId,
      input.target_type,
      input.target_id,
      input.module
    );

    // Buscar risk flag atualizada para incluir no report
    const riskFlag = await reportingRepository.findRiskFlag(
      tenantId,
      input.target_type,
      input.target_id,
      input.module
    );

    if (riskFlag) {
      // Atualizar risk_score no report (opcional, pode ser calculado on-demand)
      // Por enquanto, mantemos no risk_flags apenas
    }

    return report;
  }

  /**
   * Listar denúncias do usuário
   */
  async getReportsByReporter(
    tenantId: string,
    reporterUserId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Report[]> {
    return reportingRepository.findReportsByReporter(tenantId, reporterUserId, limit, offset);
  }

  /**
   * Listar denúncias (auditoria) com filtros
   */
  async getReports(
    tenantId: string,
    filters: {
      module?: string;
      status?: string;
      target_type?: string;
      severity?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ reports: Report[]; total: number }> {
    return reportingRepository.findReports(tenantId, filters);
  }

  /**
   * Buscar denúncia por ID
   */
  async getReportById(tenantId: string, reportId: string): Promise<Report | null> {
    return reportingRepository.findReportById(tenantId, reportId);
  }

  /**
   * Atualizar status da denúncia
   * Conforme REPORTING_CORE.md:
   * - comentário obrigatório ao encerrar
   * - criar evento correspondente
   * - atualizar resolved_at quando aplicável
   */
  async updateReportStatus(
    tenantId: string,
    reportId: string,
    input: UpdateReportStatusInput
  ): Promise<Report> {
    const report = await reportingRepository.findReportById(tenantId, reportId);
    if (!report) {
      throw new Error('Denúncia não encontrada');
    }

    // Validar comentário obrigatório ao encerrar
    if ((input.status === 'RESOLVED' || input.status === 'DISMISSED') && !input.comment) {
      throw new Error('Comentário é obrigatório ao encerrar uma denúncia');
    }

    // Determinar resolved_at
    const resolvedAt =
      input.status === 'RESOLVED' || input.status === 'DISMISSED' ? new Date() : undefined;

    // Atualizar status
    const updatedReport = await reportingRepository.updateReportStatus(
      tenantId,
      reportId,
      input.status,
      resolvedAt
    );

    if (!updatedReport) {
      throw new Error('Erro ao atualizar status da denúncia');
    }

    // Criar evento de audit trail
    await reportingRepository.createReportEvent({
      report_id: reportId,
      actor_type: input.actor_type,
      actor_id: input.actor_id,
      event_type: 'STATUS_CHANGED',
      metadata: {
        old_status: report.status,
        new_status: input.status,
        comment: input.comment,
      },
    });

    // Se encerrado, recalcular risk score
    if (input.status === 'RESOLVED' || input.status === 'DISMISSED') {
      await riskScoringEngine.updateRiskFlag(
        tenantId,
        report.target_type,
        report.target_id,
        report.module
      );
    }

    return updatedReport;
  }

  /**
   * Buscar eventos de uma denúncia (audit trail)
   */
  async getReportEvents(reportId: string): Promise<ReportEvent[]> {
    return reportingRepository.findReportEvents(reportId);
  }

  /**
   * Buscar risk flag de um target
   */
  async getRiskFlag(
    tenantId: string,
    targetType: string,
    targetId: string,
    module: string
  ) {
    return reportingRepository.findRiskFlag(tenantId, targetType, targetId, module);
  }
}

export const reportingService = new ReportingService();






