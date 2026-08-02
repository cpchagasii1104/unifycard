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
    const badgeRaw = this.getScoreBadge(currentScore);
    const badge = (badgeRaw === 'BLOCKED' ? 'blocked' : badgeRaw === 'CRITICAL' ? 'critical' : badgeRaw === 'EXCELLENT' ? 'excellent' : badgeRaw === 'GOOD' ? 'good' : 'warning') as TrustDashboard['scoreBadge'];

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
      scoreMessage: this.getScoreMessage(badgeRaw),
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
      created_at: Date;
      previous_score: number;
      new_score: number;
      change_amount: number;
      reason: string;
      event_id: string | null;
    }>(
      tenantId,
      `
      SELECT created_at, previous_score, new_score, change_amount, reason, event_id
      FROM actor_score_history
      WHERE tenant_id = $1 AND actor_score_id = $2
        AND created_at >= $3
      ORDER BY created_at DESC
      `,
      [tenantId, score.id, since]
    );

    return (history || []).map((h) => ({
      date: h.created_at.toISOString(),
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

    // ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
    // ║ STATUS:  REESCRITO em 2026-08-02 (GO de Clayton) — a versão anterior estava MORTA desde
    // ║          o gênesis: UNION com `event_participants` (tabela AUSENTE) lendo
    // ║          `attendance_status` (coluna que `event_attendees` NÃO tem; a real é `status`)
    // ║          e comparando 'PRESENT'/'NO_SHOW'/'LEFT_EARLY' (vocabulário do desenho anterior).
    // ║ NORMA:   vocabulário REAL de event_attendees.status (CHECK físico):
    // ║          registered · cancelled · attended · no_show.
    // ║ NÃO:     reintroduzir LEFT_EARLY — decisão de Clayton (2026-08-02): o estado MORREU no
    // ║          desenho novo; nada o grava e nenhum sucessor existe.
    // ╚════════════════════════════════════════════════════════════════
    const participantStats = await runQueryWithTenant<{
      events_participated: number;
      check_ins: number;
      no_shows: number;
    }>(
      tenantId,
      `
      SELECT
        COUNT(DISTINCT event_id) as events_participated,
        COUNT(CASE WHEN status = 'attended' THEN 1 END) as check_ins,
        COUNT(CASE WHEN status = 'no_show' THEN 1 END) as no_shows
      FROM event_attendees
      WHERE tenant_id = $1 AND actor_id = $2
      `,
      [tenantId, actorId]
    );

    const aggregated = participantStats || { events_participated: 0, check_ins: 0, no_shows: 0 };

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
        COUNT(CASE WHEN status = 'ended' THEN 1 END) as successful,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled
      FROM events
      WHERE tenant_id = $1 AND actor_id = $2
      `,
      [tenantId, actorId]
    );

    // Estatísticas de prestador — REESCRITO 2026-08-02: a fonte anterior era a MESMA tabela
    // fantasma. O substrato VIVO de entrega de serviço é `service_orders` (worker_actor_id +
    // status minúsculo do enum service_order_status). "Entrega parcial" morreu junto com
    // LEFT_EARLY (decisão de Clayton): nenhum substrato a distingue — 0 aqui é PROVÁVEL
    // (nada a grava), não desconhecido.
    const providerStats = await runQueryWithTenant<{
      services_completed: number;
    }>(
      tenantId,
      `
      SELECT COUNT(*) as services_completed
      FROM service_orders
      WHERE tenant_id = $1 AND worker_actor_id = $2
        AND status IN ('completed', 'funds_released')
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
        fullDeliveries: providerStats?.services_completed || 0, // a conflacao antiga (check-in de EVENTO contado como entrega de SERVICO) morreu com a fonte fantasma
        partialDeliveries: 0, // conceito morreu com LEFT_EARLY (Clayton, 2026-08-02); nenhum substrato o grava — 0 provável, não desconhecido
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
    void actorType; // reservado para FASE 6 (filtro por tipo de devedor, se necessário)

    // TODO DECISION-0007 / FASE 6: semântica real de reputação financeira.
    // A tabela "ledger" não existe no schema Gênesis (SSOT é bank_ledger
    // com modelo diferente — sem entry_type, sem metadata). Reimplementação
    // via bank_ledger exige definição de produto: o que é "recebido",
    // "pago", "impacto gerado" para efeito de reputação.
    // Até lá, retornar zeros mantém contrato sem inventar semântica.

    // pendingDebts vem de actor_debts (tabela canônica), não de ledger
    const debtsResult = await runQueryWithTenant<{ pending_debts: string | number }>(
      tenantId,
      `
      SELECT COALESCE(SUM(amount_cents), 0) as pending_debts
      FROM actor_debts
      WHERE tenant_id = $1
        AND debtor_actor_id = $2
        AND status = 'pending'
      `,
      [tenantId, actorId]
    );

    const rawPending = debtsResult?.pending_debts;
    const pendingDebtsCents =
      typeof rawPending === 'string' ? parseInt(rawPending, 10) : Number(rawPending ?? 0);

    return {
      totalReceived: 0,
      asOrganizer: 0,
      asProvider: 0,
      totalPaid: 0,
      impactGenerated: {
        community: 0,
        city: 0,
        region: 0,
      },
      pendingDebts: pendingDebtsCents / 100,
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
        COALESCE(SUM(CASE WHEN status = 'transferred_to_organizer' THEN amount_cents ELSE 0 END), 0) as total_paid
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
        -- CHECK chk_actor_debts_status: 'pending' + 'transferred_to_organizer' (§4.11, convergido 2026-08-02).
        -- 'paid' não existe no CHECK — nada o escreve; adicioná-lo seria permissão.
        -- Convergência defensiva ao vocabulário vigente do CHECK até DECISION sobre
        -- vocabulário canônico final (DT-C36-actor-debts-case-drift).
        AND status = 'transferred_to_organizer'
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
    // ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
    // ║ STATUS:  ESVAZIADO em 2026-08-02 (mesma fatia do getStats, GO de Clayton)
    // ║ NORMA:   `actor_penalties` NÃO EXISTE no schema canônico (to_regclass → NULL) — as duas
    // ║          queries anteriores morriam em 42P01 e derrubavam o dashboard inteiro.
    // ║ NÃO:     materializar a tabela para reviver isto (forward-only, cria casa nova sem GATE),
    // ║          nem devolver erro: penalidade AUSENTE DE SUBSTRATO = provadamente zero
    // ║          penalidades — 0 aqui é FATO (nada pode gravá-las), não zero-mentiroso.
    // ║ EM VEZ:  quando o substrato de penalidades nascer (frente própria, com GATE), religar
    // ║          aqui. O tipo de retorno é preservado.
    // ╚════════════════════════════════════════════════════════════════
    const active: TrustDashboard['penalties']['active'] = [];
    const history: TrustDashboard['penalties']['history'] = [];

    return { active, history };
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


