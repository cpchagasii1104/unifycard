// src/core/reputation/penalty.service.ts
// Sistema de Penalidades (Contrato v1.3)
// FASE 10: ESCROW + PENALIDADES + RESPONSABILIZAÇÃO
//
// REGRA ABSOLUTA: Penalidades automáticas baseadas em comportamento real
//
// SPRINT 66: HARDENING LÓGICO
// - Thresholds movidos para Policy Registry
// - Soft-block por padrão (alerta, não bloqueio)
// - Hard-block apenas se strict_mode=true

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { eventBus } from '@core/events/event-bus';
import { BadRequestError } from '@core/errors';
import { policyRegistry } from '@core/policy/policy-registry';

// Configuração de penalidades conforme CONTRATO v1.3
interface PenaltyConfig {
  scoreChange: number;
  type: string;
  financialRate?: number;
  duration?: number; // dias
}

export const PENALTY_CONFIG: Record<string, PenaltyConfig> = {
  // Organizadores
  CANCEL_LESS_THAN_24H: { scoreChange: -20, financialRate: 0.10, type: 'FINANCIAL_HOLD' },
  CANCEL_LESS_THAN_7D: { scoreChange: -10, financialRate: 0.05, type: 'SCORE_REDUCTION' },
  CANCEL_7_30_DAYS: { scoreChange: -10, financialRate: 0.02, type: 'SCORE_REDUCTION' },
  CANCEL_MORE_THAN_30D: { scoreChange: -5, financialRate: 0, type: 'SCORE_REDUCTION' },
  HIGH_COMPLAINT_RATE: { scoreChange: -15, type: 'CREATION_SUSPENDED', duration: 30 },
  LOW_CHECKIN_RATE: { scoreChange: -10, type: 'SCORE_REDUCTION' },
  FALSE_INFO: { scoreChange: -50, type: 'ACCOUNT_SUSPENDED', duration: 90 },
  FRAUD: { scoreChange: -100, type: 'PERMANENT_BAN' },

  // Prestadores (Atração Principal)
  NO_SHOW: { scoreChange: -50, type: 'INVITATION_BLOCKED', duration: 60 },
  LATE_CANCEL: { scoreChange: -15, type: 'SCORE_REDUCTION' },
  PARTIAL_DELIVERY: { scoreChange: -20, type: 'SCORE_REDUCTION' },
  LATE_NOTICE_24H: { scoreChange: -30, type: 'INVITATION_BLOCKED', duration: 30 },
  LATE_NOTICE_7D: { scoreChange: -15, type: 'SCORE_REDUCTION' },

  // Colaboradores
  COLLABORATOR_NO_SHOW: { scoreChange: -30, type: 'SCORE_REDUCTION' },
  COLLABORATOR_LATE_CANCEL: { scoreChange: -15, type: 'SCORE_REDUCTION' },
  COLLABORATOR_PARTIAL: { scoreChange: -10, type: 'SCORE_REDUCTION' },

  // Compradores
  BUYER_NO_SHOW: { scoreChange: -5, type: 'SCORE_REDUCTION' },
  MULTIPLE_NO_SHOWS: { scoreChange: -15, type: 'PURCHASE_RESTRICTED', duration: 30 },
  FRAUDULENT_CHARGEBACK: { scoreChange: -100, type: 'PERMANENT_BAN' },

  // Groups
  GROUP_LOW_ATTENDANCE: { scoreChange: -20, type: 'CREATION_SUSPENDED', duration: 60 },
  GROUP_ACTING_AS_COMPANY: { scoreChange: -50, type: 'ACCOUNT_SUSPENDED' },
};

// Thresholds de score conforme CONTRATO v1.3
// SPRINT 66: Mantidos para compatibilidade, mas valores devem vir do Policy Registry
export const SCORE_THRESHOLDS = {
  EXCELLENT: 80,
  GOOD: 60,
  WARNING: 40,
  CRITICAL: 20,
  BLOCKED: 0,
};

interface ActorScoreRow {
  id: string;
  tenant_id: string;
  actor_id: string;
  actor_type: string;
  current_score: number;
  total_events_organized: number;
  total_events_participated: number;
  total_check_ins: number;
  total_no_shows: number;
  total_cancellations: number;
  total_complaints_received: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ActorPenaltyRow {
  id: string;
  tenant_id: string;
  actor_id: string;
  actor_type: string;
  penalty_type: string;
  reason: string;
  event_id: string | null;
  severity: string;
  startsAt: Date;
  endsAt: Date | null;
  status: string;
  financial_amount_cents: number | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

class PenaltyService {
  /**
   * Aplica penalidade a um ator
   * CONTRATO v1.3: Penalidades automáticas baseadas em comportamento
   */
  async applyPenalty(
    tenantId: string,
    actorId: string,
    actorType: 'user' | 'page' | 'group',
    penaltyKey: keyof typeof PENALTY_CONFIG,
    eventId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const config = PENALTY_CONFIG[penaltyKey];
    if (!config) {
      throw new BadRequestError(`Penalidade desconhecida: ${penaltyKey}`);
    }

    // Atualizar score
    await this.updateScore(tenantId, actorId, actorType, config.scoreChange, penaltyKey, eventId, metadata);

    // Criar penalidade se necessário (não apenas redução de score)
    if (config.type !== 'SCORE_REDUCTION') {
      const endsAt = config.duration
        ? new Date(Date.now() + config.duration * 24 * 60 * 60 * 1000)
        : null;

      await runQueryWithTenant(
        tenantId,
        `INSERT INTO actor_penalties 
         (tenant_id, actor_id, actor_type, penalty_type, reason, event_id, severity, startsAt, endsAt, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $8, 'active')
         ON CONFLICT DO NOTHING`,
        [
          tenantId,
          actorId,
          actorType,
          config.type,
          penaltyKey,
          eventId || null,
          config.scoreChange <= -50 ? 'critical' : config.scoreChange <= -20 ? 'high' : 'medium',
          endsAt,
        ]
      );
    }

    await eventBus.publish({
      tenantId,
      type: 'penalty.applied',
      payload: { actorId, actorType, penaltyKey, eventId, scoreChange: config.scoreChange },
    });
  }

  /**
   * Atualiza score baseado em attendance_status
   * CONTRATO v1.4: PRESENT → +2, LEFT_EARLY → -5, NO_SHOW → -10
   */
  async updateScoreFromAttendance(
    tenantId: string,
    actorId: string,
    actorType: 'user' | 'page',
    attendanceStatus: 'PRESENT' | 'LEFT_EARLY' | 'NO_SHOW',
    eventId?: string
  ): Promise<void> {
    let scoreChange = 0;
    let reason = '';

    if (attendanceStatus === 'PRESENT') {
      scoreChange = 2;
      reason = 'PRESENT';
    } else if (attendanceStatus === 'LEFT_EARLY') {
      scoreChange = -5;
      reason = 'LEFT_EARLY';
    } else if (attendanceStatus === 'NO_SHOW') {
      scoreChange = -10;
      reason = 'NO_SHOW';
    }

    if (scoreChange !== 0) {
      await this.updateScore(tenantId, actorId, actorType, scoreChange, reason, eventId);
    }
  }

  /**
   * Atualiza score do ator
   * CONTRATO v1.3: Score baseado em comportamento real
   */
  async updateScore(
    tenantId: string,
    actorId: string,
    actorType: 'user' | 'page' | 'group',
    change: number,
    reason: string,
    eventId?: string,
    metadata?: Record<string, any>
  ): Promise<number> {
    // Buscar ou criar score
    let score = await this.getScore(tenantId, actorId, actorType);
    if (!score) {
      await this.createScore(tenantId, actorId, actorType);
      score = await this.getScore(tenantId, actorId, actorType);
      if (!score) {
        throw new Error('Falha ao criar score');
      }
    }

    const previousScore = score.current_score;
    const newScore = Math.max(0, Math.min(100, previousScore + change));

    // Atualizar score
    await runQueryWithTenant(
      tenantId,
      `UPDATE actor_scores 
       SET current_score = $1, updatedAt = now()
       WHERE tenant_id = $2 AND actor_id = $3 AND actor_type = $4`,
      [newScore, tenantId, actorId, actorType]
    );

    // Registrar histórico
    await runQueryWithTenant(
      tenantId,
      `INSERT INTO actor_score_history 
       (tenant_id, actor_score_id, previous_score, new_score, change_amount, reason, event_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        tenantId,
        score.id,
        previousScore,
        newScore,
        change,
        reason,
        eventId || null,
        JSON.stringify(metadata || {}),
      ]
    );

    // Verificar se cruzou threshold crítico
    if (previousScore >= SCORE_THRESHOLDS.CRITICAL && newScore < SCORE_THRESHOLDS.CRITICAL) {
      await this.applyPenalty(tenantId, actorId, actorType, 'LOW_CHECKIN_RATE', eventId);
    }

    // Verificar se caiu para bloqueado
    if (previousScore >= SCORE_THRESHOLDS.BLOCKED && newScore < SCORE_THRESHOLDS.BLOCKED) {
      await this.applyPenalty(tenantId, actorId, actorType, 'FRAUD', eventId);
    }

    return newScore;
  }

  /**
   * Verifica se ator tem débitos pendentes
   * CONTRATO v1.4: Débito pendente bloqueia ações críticas
   */
  async hasPendingDebts(
    tenantId: string,
    actorId: string,
    actorType: 'user' | 'page' | 'group'
  ): Promise<{ hasDebt: boolean; totalAmountCents?: number }> {
    const result = await runQueryWithTenant<{ totalCents: string }>(
      tenantId,
      `SELECT COALESCE(SUM(amount_cents), 0)::text as total
       FROM actor_debts
       WHERE tenant_id = $1 
         AND debtor_actor_id = $2 
         AND debtor_actor_type = $3
         AND status = 'pending'`,
      [tenantId, actorId, actorType]
    );

    const totalAmountCents = parseInt(result?.total || '0', 10);
    return {
      hasDebt: totalAmountCents > 0,
      totalAmountCents: totalAmountCents > 0 ? totalAmountCents : undefined,
    };
  }

  /**
   * Verifica se ator pode realizar ação
   * CONTRATO v1.3: Score impacta permissões
   * CONTRATO v1.4: Débito pendente bloqueia ações críticas
   */
  /**
   * SPRINT 66: Verifica se ação pode ser executada
   * 
   * Comportamento:
   * - Débitos pendentes: sempre bloqueiam (hard-block, segurança financeira)
   * - Score baixo: soft-block por padrão (alerta), hard-block apenas se strict_mode=true
   * - Penalidades ativas: sempre bloqueiam (hard-block, decisão explícita)
   * 
   * 🔴 LEGACY — NÃO USAR COMO DECISÃO DE AUTORIZAÇÃO
   * Este método retorna estado/condição (ex: dívidas), não autorização.
   * NÃO usar canPerformAction() como decisão.
   * A decisão final DEVE passar por authorization.service.canActAs().
   * Este método só pode ser usado como condição adicional.
   */
  async canPerformAction(
    tenantId: string,
    actorId: string,
    actorType: 'user' | 'page' | 'group',
    action: 'CREATE_EVENT' | 'RECEIVE_INVITATION' | 'PURCHASE' | 'PARTICIPATE',
    actingUserId?: string
  ): Promise<{ allowed: boolean; reason?: string; warning?: string; referenceId?: string }> {
    // Verificar débitos pendentes PRIMEIRO (antes de qualquer early return)
    // CONTRATO v1.4: CREATE_EVENT, PURCHASE são bloqueados por débito
    // CORREÇÃO: Actor novo com débito também deve ser bloqueado
    if (action === 'CREATE_EVENT' || action === 'PURCHASE') {
      const debtCheck = await this.hasPendingDebts(tenantId, actorId, actorType);
      if (debtCheck.hasDebt) {
        const amountReais = (debtCheck.totalAmountCents! / 100).toFixed(2);
        return {
          allowed: false,
          reason: `Conta bloqueada: débito pendente (R$${amountReais}). Quite para continuar.`,
        };
      }
    }

    const score = await this.getScore(tenantId, actorId, actorType);
    if (!score) {
      return { allowed: true }; // Novo ator sem débito, permitir
    }

    // SPRINT 66: Ler thresholds do Policy Registry
    const warningThreshold = policyRegistry.getPolicyValue<number>(
      'risk',
      'score_threshold_warning',
      SCORE_THRESHOLDS.WARNING
    ) || SCORE_THRESHOLDS.WARNING;

    const criticalThreshold = policyRegistry.getPolicyValue<number>(
      'risk',
      'score_threshold_critical',
      SCORE_THRESHOLDS.CRITICAL
    ) || SCORE_THRESHOLDS.CRITICAL;

    const strictMode = policyRegistry.getPolicyValue<boolean>(
      'risk',
      'strict_mode',
      false
    ) || false;

    // Verificar score mínimo
    let scoreCheck: { threshold: number; actionName: string } | null = null;
    if (action === 'CREATE_EVENT' && score.current_score < warningThreshold) {
      scoreCheck = { threshold: warningThreshold, actionName: 'criar eventos' };
    } else if (action === 'RECEIVE_INVITATION' && score.current_score < warningThreshold) {
      scoreCheck = { threshold: warningThreshold, actionName: 'receber convites' };
    } else if (action === 'PURCHASE' && score.current_score < criticalThreshold) {
      scoreCheck = { threshold: criticalThreshold, actionName: 'comprar ingressos' };
    }

    if (scoreCheck) {
      // SPRINT 66: Soft-block por padrão (alerta), hard-block apenas se strict_mode=true
      const reasonCode = `SCORE_TOO_LOW_${action}`;
      const reason = `Score muito baixo (${score.current_score} < ${scoreCheck.threshold}) para ${scoreCheck.actionName}`;

      // Registrar auditoria
      const { auditService } = await import('@core/audit/audit.service');
      const auditEvent = await auditService.record(tenantId, {
        event_type: 'RISK_SCORE_CHECK',
        severity: strictMode ? 'high' : 'medium',
        actor_id: actorId,
        actor_type: actorType === 'group' ? 'user' : actorType, // 'group' não suportado, usar 'user' como fallback
        source: 'penalty_service',
        context: {
          action,
          current_score: score.current_score,
          threshold: scoreCheck.threshold,
          strict_mode: strictMode,
          reason_code: reasonCode,
          acting_user_id: actingUserId || null,
        },
      });
      const auditReferenceId = auditEvent.id;

      // Criar alerta (soft-block)
      try {
        const { alertService } = await import('@modules/automation/alert.service');
        await alertService.createAlert(tenantId, {
          type: 'RISK_SCORE_LOW',
          severity: strictMode ? 'high' : 'medium',
          message: `Score baixo detectado para ação ${action}: ${reason}`,
          entityType: actorType,
          entityId: actorId,
          metadata: {
            action,
            current_score: score.current_score,
            threshold: scoreCheck.threshold,
            strict_mode: strictMode,
            reason_code: reasonCode,
            audit_reference_id: auditReferenceId,
          },
        });
      } catch (alertError) {
        // Não bloquear se alerta falhar
        console.warn('[PenaltyService] Erro ao criar alerta (não crítico):', alertError);
      }

      // Se strict_mode=true, bloquear (hard-block)
      if (strictMode) {
        return {
          allowed: false,
          reason,
          referenceId: auditReferenceId,
        };
      }

      // Se strict_mode=false, permitir mas avisar (soft-block)
      return {
        allowed: true,
        warning: reason,
        referenceId: auditReferenceId,
      };
    }

    // Verificar penalidades ativas (sempre bloqueiam)
    const activePenalty = await this.getActivePenalty(tenantId, actorId, actorType, action);
    if (activePenalty) {
      return { allowed: false, reason: `Penalidade ativa: ${activePenalty.reason}` };
    }

    return { allowed: true };
  }

  /**
   * Processa cancelamento de evento
   * CONTRATO v1.3: Penalidade baseada em tempo antes do evento
   */
  async processEventCancellation(
    tenantId: string,
    eventId: string,
    organizerActorId: string,
    organizerActorType: 'user' | 'page',
    hoursBeforeEvent: number
  ): Promise<void> {
    let penaltyKey: string;
    if (hoursBeforeEvent < 24) {
      penaltyKey = 'CANCEL_LESS_THAN_24H';
    } else if (hoursBeforeEvent < 168) {
      // 7 dias
      penaltyKey = 'CANCEL_LESS_THAN_7D';
    } else if (hoursBeforeEvent < 720) {
      // 30 dias
      penaltyKey = 'CANCEL_7_30_DAYS';
    } else {
      penaltyKey = 'CANCEL_MORE_THAN_30D';
    }

    await this.applyPenalty(tenantId, organizerActorId, organizerActorType, penaltyKey, eventId, {
      hoursBeforeEvent,
    });
  }

  /**
   * Processa no-show de atração principal
   * CONTRATO v1.3: Atração principal que falta causa cancelamento
   */
  async processMainAttractionNoShow(
    tenantId: string,
    eventId: string,
    attractionActorId: string,
    attractionActorType: 'user' | 'page',
    noticeHours?: number
  ): Promise<void> {
    let penaltyKey: string;
    if (!noticeHours || noticeHours < 24) {
      penaltyKey = 'NO_SHOW';
    } else if (noticeHours < 168) {
      // 7 dias
      penaltyKey = 'LATE_NOTICE_7D';
    } else {
      penaltyKey = 'LATE_NOTICE_24H';
    }

    await this.applyPenalty(tenantId, attractionActorId, attractionActorType, penaltyKey, eventId, {
      noticeHours,
    });
  }

  /**
   * Processa no-show de colaborador
   * CONTRATO v1.3: Colaborador que falta não recebe
   */
  async processCollaboratorNoShow(
    tenantId: string,
    eventId: string,
    collaboratorActorId: string,
    collaboratorActorType: 'user' | 'page',
    noticeHours?: number
  ): Promise<void> {
    let penaltyKey: string;
    if (!noticeHours || noticeHours < 24) {
      penaltyKey = 'COLLABORATOR_NO_SHOW';
    } else {
      penaltyKey = 'COLLABORATOR_LATE_CANCEL';
    }

    await this.applyPenalty(tenantId, collaboratorActorId, collaboratorActorType, penaltyKey, eventId, {
      noticeHours,
    });
  }

  /**
   * Processa no-show de comprador
   * CONTRATO v1.3: Comprador que não vai perde ingresso
   */
  async processBuyerNoShow(
    tenantId: string,
    eventId: string,
    buyerActorId: string
  ): Promise<void> {
    // Contar no-shows recentes
    const recentNoShows = await this.countRecentNoShows(tenantId, buyerActorId, 90);
    if (recentNoShows >= 3) {
      await this.applyPenalty(tenantId, buyerActorId, 'user', 'MULTIPLE_NO_SHOWS', eventId);
    } else {
      await this.applyPenalty(tenantId, buyerActorId, 'user', 'BUYER_NO_SHOW', eventId);
    }
  }

  /**
   * Obtém score do ator
   */
  async getScore(
    tenantId: string,
    actorId: string,
    actorType: 'user' | 'page' | 'group'
  ): Promise<ActorScoreRow | null> {
    return (
      (await runQueryWithTenant<ActorScoreRow>(
        tenantId,
        `SELECT * FROM actor_scores WHERE tenant_id = $1 AND actor_id = $2 AND actor_type = $3`,
        [tenantId, actorId, actorType]
      )) || null
    );
  }

  /**
   * Cria score inicial para ator
   */
  private async createScore(
    tenantId: string,
    actorId: string,
    actorType: 'user' | 'page' | 'group'
  ): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `INSERT INTO actor_scores (tenant_id, actor_id, actor_type, current_score)
       VALUES ($1, $2, $3, 80)
       ON CONFLICT (tenant_id, actor_id, actor_type) DO NOTHING`,
      [tenantId, actorId, actorType]
    );
  }

  /**
   * Obtém penalidade ativa que bloqueia ação
   */
  private async getActivePenalty(
    tenantId: string,
    actorId: string,
    actorType: 'user' | 'page' | 'group',
    action: string
  ): Promise<ActorPenaltyRow | null> {
    const typeMapping: Record<string, string[]> = {
      CREATE_EVENT: ['CREATION_SUSPENDED', 'ACCOUNT_SUSPENDED', 'PERMANENT_BAN'],
      RECEIVE_INVITATION: ['INVITATION_BLOCKED', 'ACCOUNT_SUSPENDED', 'PERMANENT_BAN'],
      PURCHASE: ['PURCHASE_RESTRICTED', 'ACCOUNT_SUSPENDED', 'PERMANENT_BAN'],
      PARTICIPATE: ['ACCOUNT_SUSPENDED', 'PERMANENT_BAN'],
    };

    const types = typeMapping[action] || [];
    if (types.length === 0) {
      return null;
    }

    return (
      (await runQueryWithTenant<ActorPenaltyRow>(
        tenantId,
        `SELECT * FROM actor_penalties 
       WHERE tenant_id = $1 AND actor_id = $2 AND actor_type = $3
       AND status = 'ACTIVE'
       AND penalty_type = ANY($4)
       AND (endsAt IS NULL OR endsAt > now())
       LIMIT 1`,
        [tenantId, actorId, actorType, types]
      )) || null
    );
  }

  /**
   * Conta no-shows recentes
   */
  private async countRecentNoShows(tenantId: string, actorId: string, days: number): Promise<number> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `SELECT COUNT(*)::text as count
       FROM actor_score_history
       WHERE tenant_id = $1 
         AND actor_score_id IN (SELECT id FROM actor_scores WHERE actor_id = $2)
         AND reason IN ('BUYER_NO_SHOW', 'MULTIPLE_NO_SHOWS')
         AND createdAt >= $3`,
      [tenantId, actorId, since]
    );

    return parseInt(result?.count || '0', 10);
  }
}

export const penaltyService = new PenaltyService();



