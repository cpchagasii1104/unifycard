// src/core/reporting/ai/RiskScoringEngine.ts
// Risk Scoring Engine v1 (regras simples, sem IA) conforme REPORTING_CORE.md

import { reportingRepository } from '../reporting.repository';
import type { RiskLevel } from '../models/RiskFlag';
import type { Report, ReportStatus } from '../models/Report';

interface RiskCalculationResult {
  riskScore: number;
  riskLevel: RiskLevel;
}

class RiskScoringEngine {
  /**
   * Calcular risk score para um target baseado em denúncias
   * Regras v1 (conforme REPORTING_CORE.md):
   * - Contagem de denúncias nos últimos 7/30 dias
   * - Peso por severidade
   * - Peso por procedência (RESOLVED > DISMISSED)
   * - Peso por diversidade de reporters (antifraude)
   */
  async calculateRiskScore(
    tenantId: string,
    targetType: string,
    targetId: string,
    module: string
  ): Promise<RiskCalculationResult> {
    // Buscar todas as denúncias do target
    const reports = await reportingRepository.findReportsByTarget(tenantId, targetType, targetId, module);

    if (reports.length === 0) {
      return {
        riskScore: 0,
        riskLevel: 'GREEN',
      };
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Filtrar denúncias por período
    const reportsLast7Days = reports.filter((r) => r.createdAt >= sevenDaysAgo);
    const reportsLast30Days = reports.filter((r) => r.createdAt >= thirtyDaysAgo);

    // Contar reporters únicos (antifraude)
    const uniqueReporters = new Set(reports.map((r) => r.reporter_user_id)).size;

    // Calcular score base
    let score = 0;

    // Peso por período
    score += reportsLast7Days.length * 10; // 10 pontos por denúncia nos últimos 7 dias
    score += reportsLast30Days.length * 3; // 3 pontos por denúncia nos últimos 30 dias

    // Peso por severidade
    for (const report of reports) {
      switch (report.severity) {
        case 'high':
          score += 15;
          break;
        case 'medium':
          score += 8;
          break;
        case 'low':
          score += 3;
          break;
      }
    }

    // Peso por procedência (resolved aumenta score, dismissed reduz)
    for (const report of reports) {
      if (report.status === 'resolved') {
        score += 20; // Denúncia procedente aumenta risco
      } else if (report.status === 'dismissed') {
        score -= 5; // Denúncia não procedente reduz risco
      }
    }

    // Bônus por diversidade de reporters (múltiplos reporters = mais confiável)
    if (uniqueReporters >= 3) {
      score += 10; // Múltiplos reporters aumentam confiabilidade
    } else if (uniqueReporters === 1 && reports.length > 2) {
      score += 20; // Mesmo reporter múltiplas vezes = possível abuso
    }

    // Garantir score não negativo
    score = Math.max(0, score);

    // Determinar risk level
    let riskLevel: RiskLevel;
    if (score >= 50) {
      riskLevel = 'RED';
    } else if (score >= 20) {
      riskLevel = 'YELLOW';
    } else {
      riskLevel = 'GREEN';
    }

    return {
      riskScore: score,
      riskLevel,
    };
  }

  /**
   * Atualizar risk flag para um target
   */
  async updateRiskFlag(
    tenantId: string,
    targetType: string,
    targetId: string,
    module: string
  ): Promise<void> {
    const result = await this.calculateRiskScore(tenantId, targetType, targetId, module);

    await reportingRepository.upsertRiskFlag({
      target_type: targetType,
      target_id: targetId,
      module,
      tenant_id: tenantId,
      risk_level: result.riskLevel,
      risk_score: result.riskScore,
      last_evaluatedAt: new Date(),
    });
  }
}

export const riskScoringEngine = new RiskScoringEngine();