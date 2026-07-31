// backend/src/modules/trust/trust-engine.service.ts
// 🔴 BLINDAGEM INSTITUCIONAL
// Este service NÃO decide comportamento.
// Scores são apenas informativos (observacionais).
// Trust Engine Service - Motor canônico de confiança
// 🔴 BLINDAGEM: Nenhum score editável manualmente
// 🔴 BLINDAGEM: Nenhuma decisão sem evidência
// 🔴 BLINDAGEM: Regras determinísticas, sem IA opinativa

import { trustRepository } from './trust.repository';
import type {
  TrustProfile,
  TrustEvent,
  TrustEventSeverity,
  RegisterTrustEventInput,
  CanProceedInput,
  CanProceedResult,
  TrustProfileFilters,
  TrustEventFilters,
} from './trust.types';
import { BadRequestError } from '@core/errors';
import { recordBusinessAuditSafely } from '../business-audit/business-audit.helpers';

/**
 * Mapa de impacto de score por tipo de evento
 * 🔴 BLINDAGEM: Regras determinísticas, não opinativas
 */
const SCORE_IMPACT_MAP: Record<string, number> = {
  // Eventos POSITIVOS (aumentam score lentamente)
  agreement_respected: +2,
  escrow_completed_successfully: +3,
  payment_on_time: +1,
  service_completed_successfully: +2,
  positive_review: +1,
  dispute_won: +5, // Ganhar disputa é positivo

  // Eventos NEGATIVOS (reduzem score)
  dispute_opened: -5,
  dispute_lost: -15, // Perder disputa penaliza mais
  repeated_cancellation: -10,
  negative_review: -3,

  // Tentativas de BYPASS (penalizam fortemente)
  agreement_bypass_attempted: -25,
  escrow_bypass_attempted: -30,
  off_platform_signal_detected: -20,
  bypass_attempt_detected: -10, // Primeira ocorrência (pode aumentar para -25 se repetida)
  off_platform_contact_shared: -10, // Primeira ocorrência (pode aumentar para -25 se repetida)
};

/**
 * Mapa de severidade por tipo de evento
 */
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO
// ║ NORMA:   docs/01_normative/07_NOMENCLATURA_CANONICA.md §4.34
// ║ NÃO:     LOW/MEDIUM/HIGH — vocabulário de priority
// ║ EM VEZ:  CRITICAL/ERROR/WARNING/INFO/AUDIT (regra geral: low→INFO, medium→WARNING,
// ║          high→ERROR — mesmo mapeamento por evento, só o rótulo muda)
// ╚════════════════════════════════════════════════════════════════
const EVENT_SEVERITY_MAP: Record<string, TrustEventSeverity> = {
  agreement_respected: 'INFO',
  escrow_completed_successfully: 'INFO',
  payment_on_time: 'INFO',
  service_completed_successfully: 'INFO',
  positive_review: 'INFO',
  dispute_won: 'INFO',
  dispute_opened: 'WARNING',
  dispute_lost: 'ERROR',
  repeated_cancellation: 'WARNING',
  negative_review: 'WARNING',
  agreement_bypass_attempted: 'ERROR',
  escrow_bypass_attempted: 'ERROR',
  off_platform_signal_detected: 'ERROR',
  bypass_attempt_detected: 'WARNING', // Pode ser ERROR se repetida
  off_platform_contact_shared: 'WARNING', // Pode ser ERROR se repetida
};

class TrustEngineService {
  /**
   * Calcula risk level baseado no score
   */
  private calculateRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED' {
    if (score >= 75) return 'LOW';
    if (score >= 50) return 'MEDIUM';
    if (score >= 30) return 'HIGH';
    return 'BLOCKED';
  }

  /**
   * Obtém impacto de score para um tipo de evento
   */
  private getScoreImpact(eventType: string): number {
    return SCORE_IMPACT_MAP[eventType] || 0;
  }

  /**
   * Obtém severidade para um tipo de evento
   */
  private getEventSeverity(eventType: string): TrustEventSeverity {
    return EVENT_SEVERITY_MAP[eventType] || 'WARNING';
  }

  /**
   * Registra evento de trust e recalcula score
   * 🔴 BLINDAGEM: Sempre requer evidencePackId
   */
  async registerTrustEvent(
    tenantId: string,
    input: RegisterTrustEventInput
  ): Promise<{ profile: TrustProfile; event: TrustEvent }> {
    // Validar que evidence pack existe
    const { evidenceService } = await import('../evidence/evidence.service');
    try {
      await evidenceService.getPack(tenantId, input.evidencePackId);
    } catch (err) {
      throw new BadRequestError('Evidence pack não encontrado. Todo evento de trust requer evidência.');
    }

    // Obter ou criar profile
    let profile = await trustRepository.getOrCreateProfile(tenantId, input.actorId);

    // Calcular impacto
    const scoreImpact = this.getScoreImpact(input.eventType);
    const severity = input.severity || this.getEventSeverity(input.eventType);

    // Criar evento
    const event = await trustRepository.createEvent(tenantId, { ...input, severity }, scoreImpact);

    // Recalcular score
    const newScore = Math.max(0, Math.min(100, profile.currentScore + scoreImpact));
    const newRiskLevel = this.calculateRiskLevel(newScore);
    const isPositive = scoreImpact > 0;

    // Atualizar profile
    profile = await trustRepository.updateScore(tenantId, input.actorId, newScore, newRiskLevel, isPositive);

    // Criar snapshot
    await trustRepository.createSnapshot(tenantId, input.actorId, newScore, newRiskLevel, event.eventId);

    // Registrar audit log
    await recordBusinessAuditSafely(tenantId, {
      action: 'trust_event_registered',
      actorId: input.actorId,
      userId: null,
      contextType: input.contextType as any,
      contextId: input.contextId,
      metadata: {
        eventType: input.eventType,
        scoreImpact,
        previousScore: profile.currentScore - scoreImpact,
        newScore,
        riskLevel: newRiskLevel,
      },
    });

    return { profile, event };
  }

  /**
   * Busca trust profile por actor
   */
  async getTrustProfile(tenantId: string, actorId: string): Promise<TrustProfile> {
    const profile = await trustRepository.getOrCreateProfile(tenantId, actorId);
    return profile;
  }

  /**
   * Lista trust profiles com filtros
   */
  async listTrustProfiles(tenantId: string, filters: TrustProfileFilters = {}): Promise<TrustProfile[]> {
    return trustRepository.listProfiles(tenantId, filters);
  }

  /**
   * Lista trust events com filtros
   */
  async listTrustEvents(tenantId: string, filters: TrustEventFilters = {}): Promise<TrustEvent[]> {
    return trustRepository.listEvents(tenantId, filters);
  }

  /**
   * Verifica se pode prosseguir com ação baseado em trust score
   * 🔴 BLINDAGEM: NÃO bloqueia ações, apenas retorna informação observacional
   * 🔴 BLINDAGEM: Decisão final deve ser humana ou via authorization.service
   */
  async canProceedWithAction(
    tenantId: string,
    input: CanProceedInput
  ): Promise<CanProceedResult> {
    const profile = await trustRepository.getOrCreateProfile(tenantId, input.actorId);

    let canProceed = true;
    let reason: string | undefined;

    // BLOCKED: retorna informação, mas NÃO bloqueia
    if (profile.riskLevel === 'BLOCKED') {
      canProceed = true; // Não bloqueia, apenas informa
      reason = '⚠️ AVISO: Actor com trust score muito baixo. Recomenda-se revisão manual.';
    }

    // HIGH: retorna informação, mas NÃO bloqueia
    if (profile.riskLevel === 'HIGH' && this.isCriticalAction(input.action)) {
      canProceed = true; // Não bloqueia, apenas informa
      reason = '⚠️ AVISO: Trust score baixo para ação crítica. Recomenda-se revisão manual.';
    }

    // Registrar informação observacional (não bloqueio)
    if (reason) {
      await recordBusinessAuditSafely(tenantId, {
        action: 'trust_action_warning',
        actorId: input.actorId,
        userId: null,
        contextType: input.contextType || ('event' as any),
        contextId: input.contextId || 'unknown',
        metadata: {
          action: input.action,
          riskLevel: profile.riskLevel,
          currentScore: profile.currentScore,
          reason,
          note: 'Trust score é informativo, não bloqueia ações',
        },
      });
    }

    return {
      canProceed,
      reason,
      riskLevel: profile.riskLevel,
      currentScore: profile.currentScore,
    };
  }

  /**
   * Verifica se ação é crítica (requer trust alto)
   */
  private isCriticalAction(action: string): boolean {
    const criticalActions = [
      'escrow:create',
      'escrow:release',
      'agreement:finalize',
      'bundle:confirm',
    ];
    return criticalActions.includes(action);
  }

  /**
   * Recalcula score de um actor (útil para correções)
   * 🔴 BLINDAGEM: Recalcula baseado em eventos, não edita manualmente
   */
  async recalculateScore(tenantId: string, actorId: string): Promise<TrustProfile> {
    const profile = await trustRepository.getOrCreateProfile(tenantId, actorId);
    const events = await trustRepository.listEvents(tenantId, { actorId });

    // Recalcular score a partir de todos os eventos
    let calculatedScore = 70; // Score inicial neutro
    let positiveCount = 0;
    let negativeCount = 0;

    for (const event of events) {
      calculatedScore += event.scoreImpact;
      if (event.scoreImpact > 0) {
        positiveCount++;
      } else if (event.scoreImpact < 0) {
        negativeCount++;
      }
    }

    // Garantir que score está no range 0-100
    calculatedScore = Math.max(0, Math.min(100, calculatedScore));
    const newRiskLevel = this.calculateRiskLevel(calculatedScore);

    // Atualizar profile
    const updated = await trustRepository.updateScore(
      tenantId,
      actorId,
      calculatedScore,
      newRiskLevel,
      positiveCount > negativeCount
    );

    return updated;
  }
}

export const trustEngineService = new TrustEngineService();

