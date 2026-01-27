// backend/src/modules/risk-command-center/risk-dashboard.service.ts
// Risk Dashboard Service - Consolidação de dados de risco
// 🔴 BLINDAGEM: Apenas agregações read-only, nenhuma mutação
// 🔴 BLINDAGEM: Tudo determinístico e rastreável
// 🔴 BLINDAGEM: Backend é única fonte de verdade

import type {
  RiskDashboardOverview,
  ActorRiskProfile,
  RiskTimelineEvent,
  ActorRiskFilters,
} from './risk-dashboard.types';

class RiskDashboardService {
  /**
   * Calcula Overview do Risk Dashboard
   * 🔴 BLINDAGEM: Todos os dados vêm de fontes canônicas
   */
  async getOverview(tenantId: string): Promise<RiskDashboardOverview> {
    // 1. Buscar todos os trust profiles
    const { trustRepository } = await import('../trust/trust.repository');
    const profiles = await trustRepository.listProfiles(tenantId, { limit: 10000 });

    // 2. Contar por risk level
    const actorsByRiskLevel = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      BLOCKED: 0,
    };
    for (const profile of profiles) {
      actorsByRiskLevel[profile.riskLevel]++;
    }

    // 3. Buscar bypass events (últimos 30, 90, 180 dias)
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last90Days = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const last180Days = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    const bypassEvents30 = await trustRepository.listEvents(tenantId, {
      eventType: 'bypass_attempt_detected' as any,
      limit: 10000,
    });
    const bypassEvents90 = await trustRepository.listEvents(tenantId, {
      eventType: 'bypass_attempt_detected' as any,
      limit: 10000,
    });
    const bypassEvents180 = await trustRepository.listEvents(tenantId, {
      eventType: 'bypass_attempt_detected' as any,
      limit: 10000,
    });

    const bypass30 = bypassEvents30.filter((e) => e.createdAt >= last30Days).length;
    const bypass90 = bypassEvents90.filter((e) => e.createdAt >= last90Days).length;
    const bypass180 = bypassEvents180.filter((e) => e.createdAt >= last180Days).length;

    // 4. Buscar disputas abertas
    const { evidenceService } = await import('../evidence/evidence.service');
    const allPacks = await evidenceService.listPacks(tenantId, { limit: 10000 });
    const openDisputes = allPacks.filter((p) => p.disputeStatus === 'OPEN').length;

    // 5. Calcular tempo médio de resolução
    const resolvedDisputes = allPacks.filter(
      (p) => p.disputeStatus === 'RESOLVED' && p.openedAt && p.resolvedAt
    );
    let averageResolutionTimeDays: number | null = null;
    if (resolvedDisputes.length > 0) {
      const totalDays = resolvedDisputes.reduce((sum, p) => {
        if (p.openedAt && p.resolvedAt) {
          return sum + Math.round((p.resolvedAt.getTime() - p.openedAt.getTime()) / (1000 * 60 * 60 * 24));
        }
        return sum;
      }, 0);
      averageResolutionTimeDays = Math.round(totalDays / resolvedDisputes.length);
    }

    // 6. Calcular volume financeiro total (do ledger)
    const { ledgerService } = await import('../ledger/ledger.service');
    const allEntries = await ledgerService.listEntries(tenantId, { limit: 100000 });
    const totalFinancialVolumeCents = allEntries
      .filter((e) => e.entryType === 'ESCROW_HOLD' || e.entryType === 'ESCROW_RELEASE')
      .reduce((sum, e) => sum + e.amountCents, 0);

    // 7. Buscar payouts bloqueados e falhos
    const { payoutService } = await import('../payout/payout.service');
    const allPayouts = await payoutService.listOrders(tenantId, { limit: 10000 });
    const blockedPayouts = allPayouts.filter((p) => p.status === 'BLOCKED').length;
    const failedPayouts = allPayouts.filter((p) => p.status === 'FAILED').length;

    // 8. Buscar agreements abandonados (simplificado: agreements PROPOSED há mais de 30 dias sem finalização)
    const { agreementRepository } = await import('../agreements/agreement.repository');
    const allAgreements = await agreementRepository.list(tenantId, { limit: 10000 });
    const abandonedAgreements = allAgreements.filter((a) => {
      if (a.status === 'PROPOSED' || a.status === 'DRAFT') {
        const daysSinceUpdate = Math.round((now.getTime() - a.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
        return daysSinceUpdate > 30;
      }
      return false;
    }).length;

    return {
      totalActors: profiles.length,
      actorsByRiskLevel,
      totalBypassDetected: {
        last30Days: bypass30,
        last90Days: bypass90,
        last180Days: bypass180,
      },
      openDisputes,
      averageResolutionTimeDays,
      totalFinancialVolumeCents,
      blockedPayouts,
      failedPayouts,
      abandonedAgreements,
      currency: 'BRL',
    };
  }

  /**
   * Lista Actor Risk Profiles com filtros
   * 🔴 BLINDAGEM: Consolida dados de múltiplas fontes canônicas
   */
  async listActorRiskProfiles(
    tenantId: string,
    filters: ActorRiskFilters = {}
  ): Promise<ActorRiskProfile[]> {
    // 1. Buscar trust profiles
    const { trustRepository } = await import('../trust/trust.repository');
    let profiles = await trustRepository.listProfiles(tenantId, {
      riskLevel: filters.riskLevel,
      minScore: filters.minTrustScore,
      maxScore: filters.maxTrustScore,
      limit: filters.limit || 1000,
      offset: filters.offset || 0,
    });

    // 2. Para cada profile, consolidar dados
    const { evidenceService } = await import('../evidence/evidence.service');
    const { ledgerService } = await import('../ledger/ledger.service');
    const { escrowService } = await import('../escrow/escrow.service');
    const { payoutService } = await import('../payout/payout.service');
    const { agreementRepository } = await import('../agreements/agreement.repository');

    const riskProfiles: ActorRiskProfile[] = [];

    for (const profile of profiles) {
      // Buscar eventos de bypass
      const bypassEvents = await trustRepository.listEvents(tenantId, {
        actorId: profile.actorId,
        eventType: 'bypass_attempt_detected' as any,
        limit: 1000,
      });

      const now = new Date();
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const last90Days = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const last180Days = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

      const bypass30 = bypassEvents.filter((e) => e.createdAt >= last30Days).length;
      const bypass90 = bypassEvents.filter((e) => e.createdAt >= last90Days).length;
      const bypass180 = bypassEvents.filter((e) => e.createdAt >= last180Days).length;
      const lastBypassAt =
        bypassEvents.length > 0 ? bypassEvents[0].createdAt : null;

      // Buscar disputas
      const allPacks = await evidenceService.listPacks(tenantId, { limit: 10000 });
      const actorPacks = allPacks.filter((p) => {
        // Verificar se o actor está envolvido (simplificado: buscar no timeline)
        return p.timeline.some((e) => e.actorId === profile.actorId);
      });

      const openDisputes = actorPacks.filter((p) => p.disputeStatus === 'OPEN').length;
      const resolvedDisputes = actorPacks.filter((p) => p.disputeStatus === 'RESOLVED').length;

      const resolvedWithTime = actorPacks.filter(
        (p) => p.disputeStatus === 'RESOLVED' && p.openedAt && p.resolvedAt
      );
      let averageResolutionTimeDays: number | null = null;
      if (resolvedWithTime.length > 0) {
        const totalDays = resolvedWithTime.reduce((sum, p) => {
          if (p.openedAt && p.resolvedAt) {
            return sum + Math.round((p.resolvedAt.getTime() - p.openedAt.getTime()) / (1000 * 60 * 60 * 24));
          }
          return sum;
        }, 0);
        averageResolutionTimeDays = Math.round(totalDays / resolvedWithTime.length);
      }

      const lastDisputeAt =
        actorPacks.length > 0
          ? actorPacks
              .map((p) => p.openedAt || p.createdAt)
              .sort((a, b) => b.getTime() - a.getTime())[0]
          : null;

      // Buscar volume financeiro (ledger entries relacionados ao actor)
      const actorAccountId = `actor:${profile.actorId}`;
      const ledgerEntries = await ledgerService.listEntries(tenantId, { limit: 100000 });
      const actorEntries = ledgerEntries.filter(
        (e) => e.debitAccountId === actorAccountId || e.creditAccountId === actorAccountId
      );
      const financialVolumeCents = actorEntries.reduce((sum, e) => sum + e.amountCents, 0);

      // Buscar escrow
      const escrows = await escrowService.listEscrowAccounts(tenantId, { limit: 1000 });
      // Filtrar escrows relacionados ao actor (via agreements - simplificado)
      const actorEscrows = escrows; // TODO: Filtrar por agreement.requesterActorId ou providerActorId
      const escrowHeldCents = actorEscrows
        .filter((e) => e.status === 'FUNDS_HELD')
        .reduce((sum, e) => sum + (e.totalAmountCents - e.releasedAmountCents - e.refundedAmountCents), 0);
      const escrowReleasedCents = actorEscrows
        .filter((e) => e.status === 'RELEASED')
        .reduce((sum, e) => sum + e.releasedAmountCents, 0);

      // Buscar payouts
      const payouts = await payoutService.listOrders(tenantId, { limit: 10000 });
      const actorPayouts = payouts.filter((p) => p.actorId === profile.actorId);
      const blockedPayouts = actorPayouts.filter((p) => p.status === 'BLOCKED').length;
      const failedPayouts = actorPayouts.filter((p) => p.status === 'FAILED').length;

      // Buscar agreements
      const agreements = await agreementRepository.list(tenantId, { limit: 10000 });
      const actorAgreements = agreements.filter(
        (a) => a.requesterActorId === profile.actorId || a.providerActorId === profile.actorId
      );
      const now2 = new Date();
      const abandonedAgreements = actorAgreements.filter((a) => {
        if (a.status === 'PROPOSED' || a.status === 'DRAFT') {
          const daysSinceUpdate = Math.round((now2.getTime() - a.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
          return daysSinceUpdate > 30;
        }
        return false;
      }).length;

      // Coletar IDs relacionados
      const evidencePackIds = Array.from(new Set(actorPacks.map((p) => p.packId)));
      const agreementIds = Array.from(new Set(actorAgreements.map((a) => a.agreementId)));
      const payoutOrderIds = Array.from(new Set(actorPayouts.map((p) => p.orderId)));
      const ledgerEntryIds = Array.from(new Set(actorEntries.map((e) => e.entryId)));

      riskProfiles.push({
        actorId: profile.actorId,
        currentTrustScore: profile.currentScore,
        riskLevel: profile.riskLevel,
        totalEvents: profile.totalEvents,
        positiveEvents: profile.positiveEvents,
        negativeEvents: profile.negativeEvents,
        bypassDetected: {
          last30Days: bypass30,
          last90Days: bypass90,
          last180Days: bypass180,
          total: bypassEvents.length,
        },
        openDisputes,
        resolvedDisputes,
        averageResolutionTimeDays,
        financialVolumeCents,
        escrowHeldCents,
        escrowReleasedCents,
        blockedPayouts,
        failedPayouts,
        abandonedAgreements,
        lastEventAt: profile.lastEventAt,
        lastBypassAt,
        lastDisputeAt,
        evidencePackIds,
        agreementIds,
        payoutOrderIds,
        ledgerEntryIds,
        currency: 'BRL',
      });
    }

    // Aplicar filtros adicionais
    let filtered = riskProfiles;
    if (filters.hasOpenDisputes) {
      filtered = filtered.filter((p) => p.openDisputes > 0);
    }
    if (filters.hasBypassDetected) {
      filtered = filtered.filter((p) => p.bypassDetected.total > 0);
    }
    if (filters.minFinancialVolumeCents !== undefined) {
      filtered = filtered.filter((p) => p.financialVolumeCents >= filters.minFinancialVolumeCents!);
    }

    return filtered;
  }

  /**
   * Busca Risk Profile detalhado de um actor
   */
  async getActorRiskProfile(tenantId: string, actorId: string): Promise<ActorRiskProfile> {
    const profiles = await this.listActorRiskProfiles(tenantId, { limit: 10000 });
    const profile = profiles.find((p) => p.actorId === actorId);

    if (!profile) {
      const { NotFoundError } = await import('@core/errors');
      throw new NotFoundError('Actor risk profile não encontrado');
    }

    return profile;
  }

  /**
   * Gera Timeline consolidada de eventos de risco para um actor
   * 🔴 BLINDAGEM: Consolida dados de múltiplas fontes canônicas
   */
  async getActorRiskTimeline(tenantId: string, actorId: string): Promise<RiskTimelineEvent[]> {
    const timeline: RiskTimelineEvent[] = [];

    // 1. Trust Events
    const { trustRepository } = await import('../trust/trust.repository');
    const trustEvents = await trustRepository.listEvents(tenantId, {
      actorId,
      limit: 1000,
    });

    for (const event of trustEvents) {
      timeline.push({
        eventId: event.eventId,
        timestamp: event.createdAt,
        eventType: 'trust_event',
        severity: event.severity,
        title: `Trust Event: ${event.eventType}`,
        description: `Score impact: ${event.scoreImpact > 0 ? '+' : ''}${event.scoreImpact}`,
        sourceType: 'trust',
        sourceId: event.eventId,
        evidencePackId: event.evidencePackId,
        metadata: {
          eventType: event.eventType,
          scoreImpact: event.scoreImpact,
          contextType: event.contextType,
          contextId: event.contextId,
        },
      });
    }

    // 2. Bypass Detected
    const bypassEvents = trustEvents.filter((e) => e.eventType === 'bypass_attempt_detected');
    for (const event of bypassEvents) {
      timeline.push({
        eventId: event.eventId,
        timestamp: event.createdAt,
        eventType: 'bypass_detected',
        severity: 'HIGH',
        title: 'Bypass Detectado',
        description: `Tentativa de bypass detectada: ${event.eventType}`,
        sourceType: 'trust',
        sourceId: event.eventId,
        evidencePackId: event.evidencePackId,
        metadata: {
          eventType: event.eventType,
          contextType: event.contextType,
          contextId: event.contextId,
        },
      });
    }

    // 3. Disputes
    const { evidenceService } = await import('../evidence/evidence.service');
    const allPacks = await evidenceService.listPacks(tenantId, { limit: 10000 });
    const actorPacks = allPacks.filter((p) => {
      return p.timeline.some((e) => e.actorId === actorId);
    });

    for (const pack of actorPacks) {
      if (pack.disputeStatus === 'OPEN' && pack.openedAt) {
        timeline.push({
          eventId: `dispute-${pack.packId}`,
          timestamp: pack.openedAt,
          eventType: 'dispute_opened',
          severity: 'HIGH',
          title: 'Disputa Aberta',
          description: `Disputa aberta em ${pack.contextType}: ${pack.contextId.substring(0, 8)}...`,
          sourceType: 'evidence',
          sourceId: pack.packId,
          evidencePackId: pack.packId,
          metadata: {
            contextType: pack.contextType,
            contextId: pack.contextId,
          },
        });
      }

      if (pack.disputeStatus === 'RESOLVED' && pack.resolvedAt) {
        timeline.push({
          eventId: `dispute-resolved-${pack.packId}`,
          timestamp: pack.resolvedAt,
          eventType: 'dispute_resolved',
          severity: 'MEDIUM',
          title: 'Disputa Resolvida',
          description: `Disputa resolvida em ${pack.contextType}: ${pack.contextId.substring(0, 8)}...`,
          sourceType: 'evidence',
          sourceId: pack.packId,
          evidencePackId: pack.packId,
          metadata: {
            contextType: pack.contextType,
            contextId: pack.contextId,
          },
        });
      }
    }

    // 4. Escrow Events (simplificado)
    const { escrowService } = await import('../escrow/escrow.service');
    const escrows = await escrowService.listEscrowAccounts(tenantId, { limit: 1000 });
    // TODO: Filtrar escrows relacionados ao actor

    // 5. Payout Events
    const { payoutService } = await import('../payout/payout.service');
    const payouts = await payoutService.listOrders(tenantId, { limit: 10000 });
    const actorPayouts = payouts.filter((p) => p.actorId === actorId);

    for (const payout of actorPayouts) {
      if (payout.status === 'BLOCKED') {
        timeline.push({
          eventId: `payout-blocked-${payout.orderId}`,
          timestamp: payout.createdAt,
          eventType: 'payout_blocked',
          severity: 'HIGH',
          title: 'Payout Bloqueado',
          description: `Payout bloqueado: ${payout.amountCents / 100} ${payout.currency}`,
          sourceType: 'payout',
          sourceId: payout.orderId,
          evidencePackId: null,
          metadata: {
            amountCents: payout.amountCents,
            currency: payout.currency,
            reason: payout.metadata?.blockReason || 'Unknown',
          },
        });
      }

      if (payout.status === 'FAILED') {
        timeline.push({
          eventId: `payout-failed-${payout.orderId}`,
          timestamp: payout.updatedAt || payout.createdAt,
          eventType: 'payout_failed',
          severity: 'MEDIUM',
          title: 'Payout Falhou',
          description: `Payout falhou: ${payout.amountCents / 100} ${payout.currency}`,
          sourceType: 'payout',
          sourceId: payout.orderId,
          evidencePackId: null,
          metadata: {
            amountCents: payout.amountCents,
            currency: payout.currency,
            reason: payout.metadata?.failureReason || 'Unknown',
          },
        });
      }
    }

    // 6. Agreements Abandoned
    const { agreementRepository } = await import('../agreements/agreement.repository');
    const agreements = await agreementRepository.list(tenantId, { limit: 10000 });
    const actorAgreements = agreements.filter(
      (a) => a.requesterActorId === actorId || a.providerActorId === actorId
    );

    const now = new Date();
    for (const agreement of actorAgreements) {
      if (agreement.status === 'PROPOSED' || agreement.status === 'DRAFT') {
        const daysSinceUpdate = Math.round((now.getTime() - agreement.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceUpdate > 30) {
          timeline.push({
            eventId: `agreement-abandoned-${agreement.agreementId}`,
            timestamp: agreement.updatedAt,
            eventType: 'agreement_abandoned',
            severity: 'LOW',
            title: 'Agreement Abandonado',
            description: `Agreement ${agreement.status} há ${daysSinceUpdate} dias`,
            sourceType: 'agreement',
            sourceId: agreement.agreementId,
            evidencePackId: null,
            metadata: {
              status: agreement.status,
              daysSinceUpdate,
            },
          });
        }
      }
    }

    // Ordenar por timestamp (mais recente primeiro)
    timeline.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return timeline;
  }
}

export const riskDashboardService = new RiskDashboardService();




