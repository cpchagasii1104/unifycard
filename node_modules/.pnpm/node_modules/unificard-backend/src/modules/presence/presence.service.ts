// backend/src/modules/presence/presence.service.ts
// SPRINT 94: PRESENÇA + CHECK-IN SOCIAL + BENEFÍCIOS PROMOCIONAIS

import { presenceRepository } from './presence.repository';
import type {
  PresenceRsvp,
  ConfirmPresenceInput,
  PresenceContextType,
  PresenceVisibility,
  PresenceFilters,
  AttendanceStats,
} from './presence.types';

class PresenceService {
  async confirmPresence(tenantId: string, input: ConfirmPresenceInput): Promise<PresenceRsvp> {
    const rsvp = await presenceRepository.confirmPresence(
      tenantId,
      input.contextType,
      input.contextId,
      input.contactId,
      input.visibility || 'PRIVATE'
    );

    await this.recordAudit(tenantId, {
      eventType: 'PRESENCE_CONFIRMED',
      rsvpId: rsvp.id,
      contextType: input.contextType,
      contextId: input.contextId,
      contactId: input.contactId,
      visibility: rsvp.visibility,
    });

    return rsvp;
  }

  async cancelPresence(
    tenantId: string,
    contextType: PresenceContextType,
    contextId: string,
    contactId: string
  ): Promise<PresenceRsvp> {
    const rsvp = await presenceRepository.cancelPresence(tenantId, contextType, contextId, contactId);

    await this.recordAudit(tenantId, {
      eventType: 'PRESENCE_CANCELLED',
      rsvpId: rsvp.id,
      contextType,
      contextId,
      contactId,
    });

    return rsvp;
  }

  async setVisibility(
    tenantId: string,
    rsvpId: string,
    visibility: PresenceVisibility
  ): Promise<PresenceRsvp> {
    const rsvp = await presenceRepository.setVisibility(tenantId, rsvpId, visibility);

    await this.recordAudit(tenantId, {
      eventType: 'PRESENCE_VISIBILITY_CHANGED',
      rsvpId,
      visibility,
    });

    return rsvp;
  }

  async listPresence(
    tenantId: string,
    contextType: PresenceContextType,
    contextId: string,
    filters: PresenceFilters = {}
  ): Promise<PresenceRsvp[]> {
    // Por default, mostrar apenas PUBLIC
    if (filters.visibility === undefined) {
      filters.visibility = 'PUBLIC';
    }

    return await presenceRepository.listPresence(tenantId, contextType, contextId, filters);
  }

  async listMyPresence(tenantId: string, contactId: string, filters: PresenceFilters = {}): Promise<PresenceRsvp[]> {
    return await presenceRepository.listMyPresence(tenantId, contactId, filters);
  }

  async getAttendanceStats(
    tenantId: string,
    contextType: PresenceContextType,
    contextId: string
  ): Promise<AttendanceStats> {
    const stats = await presenceRepository.getAttendanceStats(tenantId, contextType, contextId);

    // Calcular no-show rate
    const totalConfirmed = stats.confirmed + stats.attended + stats.noShow;
    const noShowRate = totalConfirmed > 0 ? (stats.noShow / totalConfirmed) * 100 : 0;

    return {
      ...stats,
      noShowRate,
    };
  }

  private async recordAudit(tenantId: string, data: Record<string, any>): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, data);
    } catch (error) {
      console.warn('[PresenceService] Erro ao registrar auditoria:', error);
    }
  }
}

export const presenceService = new PresenceService();





