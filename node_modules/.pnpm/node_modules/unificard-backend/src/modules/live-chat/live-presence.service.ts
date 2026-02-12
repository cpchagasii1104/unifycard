// backend/src/modules/live-chat/live-presence.service.ts
// SPRINT 95: LOCAL CHAT (OPT-IN) + PRESENÇA AO VIVO + ANTI-ABUSO

import { livePresenceRepository } from './live-presence.repository';
import { checkinRepository } from '../presence/checkin.repository';
import { policyRegistry } from '@core/policy/policy-registry';
import type {
  LivePresence,
  OptInInput,
  PresenceContextType,
} from './live-chat.types';

class LivePresenceService {
  /**
   * Opt-in para presença ao vivo
   * 
   * REGRAS:
   * - Exige check-in recente (policy: live_chat.checkin_recency_hours)
   * - TTL baseado em policy (live_chat.ttl_minutes)
   */
  async optIn(tenantId: string, input: OptInInput): Promise<LivePresence> {
    // 1. Verificar se live chat está habilitado
    const enabled = policyRegistry.getPolicyValue<boolean>('live_chat', 'enabled', true);
    if (enabled === false) {
      throw new Error('Chat ao vivo está desabilitado');
    }

    // 2. Validar check-in recente
    const checkinRecencyHours = policyRegistry.getPolicyValue<number>('live_chat', 'checkin_recency_hours', 12);
    const hasRecentCheckin = await this.hasRecentCheckin(
      tenantId,
      input.contextType,
      input.contextId,
      input.contactId,
      checkinRecencyHours
    );

    if (!hasRecentCheckin) {
      throw new Error(`Check-in recente necessário (últimas ${checkinRecencyHours} horas)`);
    }

    // 3. Calcular TTL
    const ttlMinutes = policyRegistry.getPolicyValue<number>('live_chat', 'ttl_minutes', 20);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + ttlMinutes);

    // 4. Opt-in
    const presence = await livePresenceRepository.optIn(
      tenantId,
      input.contextType,
      input.contextId,
      input.contactId,
      expiresAt
    );

    await this.recordAudit(tenantId, {
      eventType: 'LIVE_OPT_IN',
      presenceId: presence.id,
      contextType: input.contextType,
      contextId: input.contextId,
      contactId: input.contactId,
    });

    return presence;
  }

  async optOut(
    tenantId: string,
    contextType: PresenceContextType,
    contextId: string,
    contactId: string
  ): Promise<LivePresence> {
    const presence = await livePresenceRepository.optOut(tenantId, contextType, contextId, contactId);

    await this.recordAudit(tenantId, {
      eventType: 'LIVE_OPT_OUT',
      presenceId: presence.id,
      contextType,
      contextId,
      contactId,
    });

    return presence;
  }

  async heartbeat(
    tenantId: string,
    contextType: PresenceContextType,
    contextId: string,
    contactId: string
  ): Promise<LivePresence> {
    // Calcular novo expiresAt
    const ttlMinutes = policyRegistry.getPolicyValue<number>('live_chat', 'ttl_minutes', 20);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + ttlMinutes);

    const presence = await livePresenceRepository.heartbeat(
      tenantId,
      contextType,
      contextId,
      contactId,
      expiresAt
    );

    await this.recordAudit(tenantId, {
      eventType: 'LIVE_HEARTBEAT',
      presenceId: presence.id,
      contextType,
      contextId,
      contactId,
    });

    return presence;
  }

  async listOnline(
    tenantId: string,
    contextType: PresenceContextType,
    contextId: string,
    limit: number = 50
  ): Promise<LivePresence[]> {
    // Retorna APENAS opted_in=true AND status=ONLINE AND expiresAt > now
    return await livePresenceRepository.listOnline(tenantId, contextType, contextId, limit);
  }

  private async hasRecentCheckin(
    tenantId: string,
    contextType: PresenceContextType,
    contextId: string,
    contactId: string,
    recencyHours: number
  ): Promise<boolean> {
    // Verificar se existe check-in CHECKED_IN nas últimas X horas
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - recencyHours);

    const hasCheckedIn = await checkinRepository.hasCheckedIn(tenantId, contextType, contextId, contactId);
    if (!hasCheckedIn) {
      return false;
    }

    // Verificar recency (buscar check-ins recentes)
    const checkins = await checkinRepository.listCheckins(tenantId, contextType, contextId, 100, 0);
    const recentCheckin = checkins.find(
      (c) => c.contactId === contactId && c.status === 'CHECKED_IN' && c.createdAt >= cutoff
    );

    return !!recentCheckin;
  }

  private async recordAudit(tenantId: string, data: Record<string, any>): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, data);
    } catch (error) {
      console.warn('[LivePresenceService] Erro ao registrar auditoria:', error);
    }
  }
}

export const livePresenceService = new LivePresenceService();






