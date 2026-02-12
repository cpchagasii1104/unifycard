// src/core/reporting/policies/ReportingPolicy.ts
// Políticas anti-abuso conforme REPORTING_CORE.md

import { reportingRepository } from '../reporting.repository';

class ReportingPolicy {
  /**
   * Rate limit de denúncias por usuário
   * Limitar frequência para evitar spam
   */
  async canCreateReport(tenantId: string, reporterUserId: string): Promise<{ allowed: boolean; reason?: string }> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Buscar denúncias recentes do reporter
    const recentReports = await reportingRepository.findReportsByReporter(tenantId, reporterUserId, 100, 0);

    const reportsLastHour = recentReports.filter((r) => r.createdAt >= oneHourAgo);
    const reportsLastDay = recentReports.filter((r) => r.createdAt >= oneDayAgo);

    // Limites (conforme REPORTING_CORE.md)
    if (reportsLastHour.length >= 5) {
      return {
        allowed: false,
        reason: 'Muitas denúncias na última hora. Aguarde alguns minutos antes de denunciar novamente.',
      };
    }

    if (reportsLastDay.length >= 20) {
      return {
        allowed: false,
        reason: 'Limite diário de denúncias atingido. Tente novamente amanhã.',
      };
    }

    return { allowed: true };
  }

  /**
   * Verificar se usuário pode atualizar status (apenas auditores)
   * Esta verificação será feita via RBAC nas rotas
   */
  canUpdateStatus(): boolean {
    // Implementação via RBAC middleware
    return true;
  }
}

export const reportingPolicy = new ReportingPolicy();







