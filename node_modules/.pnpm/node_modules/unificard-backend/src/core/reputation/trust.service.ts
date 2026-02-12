// src/core/reputation/trust.service.ts
// Serviço de Dashboard de Confiança (Contrato v1.3)
// FASE 10: ESCROW + PENALIDADES + RESPONSABILIZAÇÃO
//
// REGRA ABSOLUTA: Reputação baseada em comportamento real, não em opinião

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { penaltyService } from './penalty.service';
import { NotFoundError } from '@core/errors';

export interface TrustDashboard {
  // Score principal
  currentScore: number;
  scoreBadge: 'excellent' | 'good' | 'warning' | 'critical' | 'blocked';
  scoreMessage: string;

  // Estatísticas gerais
  stats: {
    asParticipant: {
      eventsParticipated: number;
      checkIns: number;
      checkInRate: number;
      noShows: number;
      averageRating: number;
    };
    asOrganizer: {
      eventsCreated: number;
      successful: number;
      cancelled: number;
      complaints: number;
    };
    asProvider: {
      servicesCompleted: number;
      fullDeliveries: number;
      partialDeliveries: number;
      averageRating: number;
    };
  };

  // Histórico financeiro
  financial: {
    totalReceived: number;
    asOrganizer: number;
    asProvider: number;
    totalPaid: number;
    impactGenerated: {
      community: number;
      city: number;
      region: number;
    };
    pendingDebts: number;
  };

  // Responsabilização
  responsibility: {
    asCausator: {
      times: number;
      totalDebt: number;
    };
    asGuarantor: {
      times: number;
      totalGuaranteed: number;
      totalPaid: number;
    };
    asProtected: {
      times: number;
      totalReceived: number;
    };
  };

  // Penalidades
  penalties: {
    active: Array<{
      id: string;
      type: string;
      reason: string;
      severity: string;
      endsAt: Date | null;
    }>;
    history: Array<{
      id: string;
      type: string;
      reason: string;
      createdAt: Date;
      resolvedAt: Date | null;
    }>;
  };

  // Badges
  badges: string[];
}

export interface TrustScoreTimeline {
  date: string;
  score: number;
  change: number;
  reason: string;
  eventId?: string;
}

class TrustService {
  /**
   * Obtém dashboard completo de confiança
   * CONTRATO v1.3: Dados reais de comportamento
   */
  async getDashboard(
    tenantId: string,
    actorId: string,
    actorType: 'user' | 'page' | 'group'
  ): Promise<TrustDashboard> {
    const score = await penaltyService.getScore(tenantId, actorId, actorType);
    if (!score) {
      // Criar score inicial
      await penaltyService.updateScore(tenantId, actorId, actorType, 0, 'INITIAL', undefined);
      return this.getDashboard(tenantId, actorId, actorType); // Recursão
    }

    const currentScore = score.current_score;
    const badge = this.getScoreBadge(currentScore);

    // Estatísticas
    const stats = await this.getStats(tenantId, actorId, actorType);

    // Financeiro
    const financial = await this.getFinancialHistory(tenantId, actorId, actorType);

    // Responsabilização
    const responsibility = await this.getResponsibility(tenantId, actorId, actorType);

    // Penalidades
    const penalties = await this.getPenalties(tenantId, actorId, actorType);

    // Badges
    const badges = await this.getBadges(tenantId, actorId, actorType, score);

    return {
      currentScore,
      scoreBadge: badge,
      scoreMessage: this.getScoreMessage(badge),
      stats,
      financial,
      responsibility,
      penalties,
      badges,
    };
  }

  /**
   * Obtém timeline de score
   * CONTRATO v1.3: Histórico auditável
   */
  async getScoreTimeline(
    tenantId: string,
    actorId: string,
    actorType: 'user' | 'page' | 'group',
    months: number = 12
  ): Promise<TrustScoreTimeline[]> {
    const score = await penaltyService.getScore(tenantId, actorId, actorType);
    if (!score) {
      return [];
    }

    const since = new Date();
    since.setMonth(since.getMonth() - months);

    const history = await runQueriesWithTenant<{
      createdAt: Date;
      previous_score: number;
      new_score: number;
      change_amount: number;
      reason: string;
      event_id: string | null;
    }>(
      tenantId,
      `
      SELECT createdAt, previous_score, new_score, change_amount, reason, event_id
      FROM actor_score_history
      WHERE tenant_id = $1 AND actor_score_id = $2
        AND createdAt >= $3
      ORDER BY createdAt DESC
      `,
      [tenantId, score.id, since]
    );

    return (history || []).map((h) => ({
      date: h.createdAt.toISOString(),
      score: h.new_score,
      change: h.change_amount,
      reason: h.reason,
      eventId: h.event_id || undefined,
    }));
  }

  /**
   * Obtém versão pública do dashboard (para outros verem)
   * CONTRATO v1.3: Visibilidade controlada
   */
  async getPublicDashboard(
    tenantId: string,
    actorId: string,
    actorType: 'user' | 'page' | 'group'
  ): Promise<{
    currentScore: number;
    scoreBadge: string;
    stats: {
      eventsParticipated: number;
      checkInRate: number;
      eventsCreated: number;
      successfulRate: number;
    };
    badges: string[];
    timeOnPlatform: number; // dias
  }> {
    const score = await penaltyService.getScore(tenantId, actorId, actorType);
    if (!score) {
      return {
        currentScore: 80,
        scoreBadge: 'GOOD',
        stats: {
          eventsParticipated: 0,
          checkInRate: 0,
          eventsCreated: 0,
          successfulRate: 0,
        },
        badges: [],
        timeOnPlatform: 0,
      };
    }

    const stats = await this.getStats(tenantId, actorId, actorType);
    const badges = await this.getBadges(tenantId, actorId, actorType, score);

    // Calcular tempo na plataforma
    const timeOnPlatform = Math.floor(
      (Date.now() - new Date(score.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      currentScore: score.current_score,
      scoreBadge: this.getScoreBadge(score.current_score),
      stats: {
        eventsParticipated: stats.asParticipant.eventsParticipated,
        checkInRate: stats.asParticipant.checkInRate,
        eventsCreated: stats.asOrganizer.eventsCreated,
        successfulRate:
          stats.asOrganizer.eventsCreated > 0
            ? stats.asOrganizer.successful / stats.asOrganizer.eventsCreated
            : 0,
      },
      badges,
      timeOnPlatform,
    };
  }

  /**
   * Obtém estatísticas do ator
   */
  private async getStats(
    tenantId: string,
    actorId: string,
    actorType: 'user' | 'page' | 'group'
  ): Promise<TrustDashboard['stats']> {
    const score = await penaltyService.getScore(tenantId, actorId, actorType);
    if (!score) {
      return {
        asParticipant: {
          eventsParticipated: 0,
          checkIns: 0,
          checkInRate: 0,
          noShows: 0,
          averageRating: 0,
        },
        asOrganizer: {
          eventsCreated: 0,
          successful: 0,
          cancelled: 0,
          complaints: 0,
        },
        asProvider: {
          servicesCompleted: 0,
          fullDeliveries: 0,
          partialDeliveries: 0,
          averageRating: 0,
        },
      };
    }

    // Estatísticas de participante (CONTRATO v1.4: usa attendance_status)
    const participantStats = await runQueryWithTenant<{
      events_participated: number;
      check_ins: number;
      no_shows: number;
      left_early: number;
    }>(
      tenantId,
      `
      SELECT 
        COUNT(DISTINCT event_id) as events_participated,
        COUNT(CASE WHEN attendance_status = 'PRESENT' THEN 1 END) as check_ins,
        COUNT(CASE WHEN attendance_status = 'NO_SHOW' THEN 1 END) as no_shows,
        COUNT(CASE WHEN attendance_status = 'LEFT_EARLY' THEN 1 END) as left_early
      FROM (
        SELECT event_id, attendance_status
        FROM event_participants
        WHERE tenant_id = $1 AND actor_id = $2 AND actor_type = $3
        UNION ALL
        SELECT event_id, attendance_status
        FROM event_attendees
        WHERE tenant_id = $1 AND actor_id = $2
      ) combined
      `,
      [tenantId, actorId, actorType]
    );

    const aggregated = participantStats || { events_participated: 0, check_ins: 0, no_shows: 0, left_early: 0 };

    const checkInRate =
      aggregated.events_participated > 0
        ? aggregated.check_ins / aggregated.events_participated
        : 0;

    // Estatísticas de organizador
    const organizerStats = await runQueryWithTenant<{
      events_created: number;
      successful: number;
      cancelled: number;
    }>(
      tenantId,
      `
      SELECT 
        COUNT(*) as events_created,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled
      FROM events
      WHERE tenant_id = $1 AND actor_id = $2
      `,
      [tenantId, actorId]
    );

    // Estatísticas de prestador
    const providerStats = await runQueryWithTenant<{
      services_completed: number;
      full_deliveries: number;
      partial_deliveries: number;
    }>(
      tenantId,
      `
      SELECT 
        COUNT(*) as services_completed,
        COUNT(CASE WHEN attendance_status = 'PRESENT' THEN 1 END) as full_deliveries,
        COUNT(CASE WHEN attendance_status = 'LEFT_EARLY' THEN 1 END) as partial_deliveries
      FROM event_participants
      WHERE tenant_id = $1 AND actor_id = $2
      `,
      [tenantId, actorId]
    );

    return {
      asParticipant: {
        eventsParticipated: aggregated.events_participated,
        checkIns: aggregated.check_ins,
        checkInRate,
        noShows: aggregated.no_shows,
        averageRating: 0, // TODO: Implementar sistema de avaliações
      },
      asOrganizer: {
        eventsCreated: organizerStats?.events_created || 0,
        successful: organizerStats?.successful || 0,
        cancelled: organizerStats?.cancelled || 0,
        complaints: score.total_complaints_received || 0,
      },
      asProvider: {
        servicesCompleted: providerStats?.services_completed || 0,
        fullDeliveries: (providerStats?.full_deliveries || 0) + aggregated.check_ins, // PRESENT conta como full delivery
        partialDeliveries: (providerStats?.partial_deliveries || 0) + aggregated.left_early, // LEFT_EARLY conta como partial
        averageRating: 0, // TODO: Implementar sistema de avaliações
      },
    };
  }

  /**
   * Obtém histórico financeiro
   */
  private async getFinancialHistory(
    tenantId: string,
    actorId: string,
    actorType: 'user' | 'page' | 'group'
  ): Promise<TrustDashboard['financial']> {
    // Agregar do ledger
    const financial = await runQueryWithTenant<{
      total_received: number;
      as_organizer: number;
      as_provider: number;
      total_paid: number;
      impact_community: number;
      impact_city: number;
      impact_region: number;
      pending_debts: number;
    }>(
      tenantId,
      `
      SELECT 
        COALESCE(SUM(CASE WHEN entry_type = 'credit' AND metadata->>'actor_id' = $2 THEN amount_cents ELSE 0 END), 0) as total_received,
        COALESCE(SUM(CASE WHEN entry_type = 'credit' AND metadata->>'actor_id' = $2 AND metadata->>'role' = 'organizer' THEN amount_cents ELSE 0 END), 0) as as_organizer,
        COALESCE(SUM(CASE WHEN entry_type = 'credit' AND metadata->>'actor_id' = $2 AND metadata->>'role' = 'provider' THEN amount_cents ELSE 0 END), 0) as as_provider,
        COALESCE(SUM(CASE WHEN entry_type = 'debit' AND metadata->>'actor_id' = $2 THEN amount_cents ELSE 0 END), 0) as total_paid,
        COALESCE(SUM(CASE WHEN entry_type = 'credit' AND metadata->>'target' = 'community' THEN amount_cents ELSE 0 END), 0) as impact_community,
        COALESCE(SUM(CASE WHEN entry_type = 'credit' AND metadata->>'target' = 'city' THEN amount_cents ELSE 0 END), 0) as impact_city,
        COALESCE(SUM(CASE WHEN entry_type = 'credit' AND metadata->>'target' = 'region' THEN amount_cents ELSE 0 END), 0) as impact_region,
        COALESCE((SELECT SUM(amount_cents) FROM actor_debts WHERE tenant_id = $1 AND debtor_actor_id = $2 AND status = 'pending'), 0) as pending_debts
      FROM ledger
      WHERE tenant_id = $1
      `,
      [tenantId, actorId]
    );

    return {
      totalReceived: (financial?.total_received || 0) / 100,
      asOrganizer: (financial?.as_organizer || 0) / 100,
      asProvider: (financial?.as_provider || 0) / 100,
      totalPaid: (financial?.total_paid || 0) / 100,
      impactGenerated: {
        community: (financial?.impact_community || 0) / 100,
        city: (financial?.impact_city || 0) / 100,
        region: (financial?.impact_region || 0) / 100,
      },
      pendingDebts: (financial?.pending_debts || 0) / 100,
    };
  }

  /**
   * Obtém dados de responsabilização
   */
  private async getResponsibility(
    tenantId: string,
    actorId: string,
    actorType: 'user' | 'page' | 'group'
  ): Promise<TrustDashboard['responsibility']> {
    const asCausator = await runQueryWithTenant<{
      times: number;
      total_debt: number;
    }>(
      tenantId,
      `
      SELECT 
        COUNT(*) as times,
        COALESCE(SUM(amount_cents), 0) as total_debt
      FROM actor_debts
      WHERE tenant_id = $1 AND debtor_actor_id = $2 AND debtor_actor_type = $3
      `,
      [tenantId, actorId, actorType]
    );

    const asGuarantor = await runQueryWithTenant<{
      times: number;
      total_guaranteed: number;
      total_paid: number;
    }>(
      tenantId,
      `
      SELECT 
        COUNT(*) as times,
        COALESCE(SUM(amount_cents), 0) as total_guaranteed,
        COALESCE(SUM(CASE WHEN status = 'TRANSFERRED_TO_ORGANIZER' THEN amount_cents ELSE 0 END), 0) as total_paid
      FROM actor_debts
      WHERE tenant_id = $1 AND guarantor_actor_id = $2 AND guarantor_actor_type = $3
      `,
      [tenantId, actorId, actorType]
    );

    const asProtected = await runQueryWithTenant<{
      times: number;
      total_received: number;
    }>(
      tenantId,
      `
      SELECT 
        COUNT(*) as times,
        COALESCE(SUM(amount_cents), 0) as total_received
      FROM actor_debts
      WHERE tenant_id = $1 AND creditor_actor_id = $2 AND creditor_actor_type = $3
        AND status IN ('paid', 'transferred_to_organizer')
      `,
      [tenantId, actorId, actorType]
    );

    return {
      asCausator: {
        times: asCausator?.times || 0,
        totalDebt: (asCausator?.total_debt || 0) / 100,
      },
      asGuarantor: {
        times: asGuarantor?.times || 0,
        totalGuaranteed: (asGuarantor?.total_guaranteed || 0) / 100,
        totalPaid: (asGuarantor?.total_paid || 0) / 100,
      },
      asProtected: {
        times: asProtected?.times || 0,
        totalReceived: (asProtected?.total_received || 0) / 100,
      },
    };
  }

  /**
   * Obtém penalidades
   */
  private async getPenalties(
    tenantId: string,
    actorId: string,
    actorType: 'user' | 'page' | 'group'
  ): Promise<TrustDashboard['penalties']> {
    const active = await runQueriesWithTenant<{
      id: string;
      penalty_type: string;
      reason: string;
      severity: string;
      endsAt: Date | null;
    }>(
      tenantId,
      `
      SELECT id, penalty_type, reason, severity, endsAt
      FROM actor_penalties
      WHERE tenant_id = $1 AND actor_id = $2 AND actor_type = $3
        AND status = 'active'
        AND (endsAt IS NULL OR endsAt > now())
      ORDER BY createdAt DESC
      `,
      [tenantId, actorId, actorType]
    );

    const history = await runQueriesWithTenant<{
      id: string;
      penalty_type: string;
      reason: string;
      createdAt: Date;
      resolvedAt: Date | null;
    }>(
      tenantId,
      `
      SELECT id, penalty_type, reason, createdAt, resolvedAt
      FROM actor_penalties
      WHERE tenant_id = $1 AND actor_id = $2 AND actor_type = $3
        AND status != 'ACTIVE'
      ORDER BY createdAt DESC
      LIMIT 20
      `,
      [tenantId, actorId, actorType]
    );

    return {
      active: (active || []).map((p) => ({
        id: p.id,
        type: p.penalty_type,
        reason: p.reason,
        severity: p.severity,
        endsAt: p.endsAt,
      })),
      history: (history || []).map((p) => ({
        id: p.id,
        type: p.penalty_type,
        reason: p.reason,
        createdAt: p.createdAt,
        resolvedAt: p.resolvedAt,
      })),
    };
  }

  /**
   * Obtém badges conquistados
   */
  private async getBadges(
    tenantId: string,
    actorId: string,
    actorType: 'user' | 'page' | 'group',
    score: any
  ): Promise<string[]> {
    const badges: string[] = [];

    // Badges baseados em estatísticas
    const stats = await this.getStats(tenantId, actorId, actorType);

    if (stats.asParticipant.eventsParticipated >= 3 && stats.asParticipant.checkInRate === 1) {
      badges.push('ESTREANTE_PROMISSOR');
    }

    if (stats.asProvider.servicesCompleted >= 10 && stats.asProvider.fullDeliveries === stats.asProvider.servicesCompleted) {
      badges.push('COLABORADOR_CONFIAVEL');
    }

    if (stats.asOrganizer.eventsCreated >= 5 && stats.asOrganizer.cancelled === 0) {
      badges.push('ORGANIZADOR_DE_SUCESSO');
    }

    if (score.current_score >= 80) {
      badges.push('MEMBRO_VETERANO');
    }

    if (stats.asParticipant.eventsParticipated >= 20 && stats.asParticipant.checkInRate === 1) {
      badges.push('ZERO_FALTAS');
    }

    // Badges de alerta
    if (score.current_score < 40 && score.current_score >= 20) {
      badges.push('EM_OBSERVACAO');
    }

    const penalties = await this.getPenalties(tenantId, actorId, actorType);
    if (penalties.active.length > 0) {
      badges.push('RESTRICAO_ATIVA');
    }

    const financial = await this.getFinancialHistory(tenantId, actorId, actorType);
    if (financial.pendingDebts > 0) {
      badges.push('DEBITO_PENDENTE');
    }

    return badges;
  }

  /**
   * Obtém badge de score
   */
  private getScoreBadge(score: number): 'EXCELLENT' | 'GOOD' | 'WARNING' | 'CRITICAL' | 'BLOCKED' {
    if (score >= 80) return 'EXCELLENT';
    if (score >= 60) return 'GOOD';
    if (score >= 40) return 'WARNING';
    if (score >= 20) return 'CRITICAL';
    return 'BLOCKED';
  }

  /**
   * Obtém mensagem de score
   */
  private getScoreMessage(badge: string): string {
    const messages: Record<string, string> = {
      EXCELLENT: 'Você é um dos mais confiáveis da plataforma',
      GOOD: 'Você tem uma boa reputação',
      WARNING: 'Sua reputação precisa de atenção',
      CRITICAL: 'Sua reputação está em risco',
      BLOCKED: 'Sua conta está bloqueada',
    };
    return messages[badge] || 'Reputação em construção';
  }
}

export const trustService = new TrustService();


