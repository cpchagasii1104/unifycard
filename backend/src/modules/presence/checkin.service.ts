// backend/src/modules/presence/checkin.service.ts
// SPRINT 94: PRESENÇA + CHECK-IN SOCIAL + BENEFÍCIOS PROMOCIONAIS

import { checkinTokenRepository } from './checkin-token.repository';
import { checkinRepository } from './checkin.repository';
import { presenceRepository } from './presence.repository';
import { promoBenefitService } from './promo-benefit.service';
import type {
  CheckinToken,
  Checkin,
  CreateCheckinTokenInput,
  CheckInByTokenInput,
  ManualCheckInInput,
  PresenceContextType,
} from './presence.types';

class CheckinService {
  async createToken(
    tenantId: string,
    input: CreateCheckinTokenInput,
    createdByActorId: string | null,
    createdByUserId: string | null
  ): Promise<CheckinToken> {
    const token = await checkinTokenRepository.createToken(
      tenantId,
      input.contextType,
      input.contextId,
      input.validFrom || null,
      input.validTo || null,
      createdByActorId,
      createdByUserId,
      input.metadata
    );

    await this.recordAudit(tenantId, {
      eventType: 'CHECKIN_TOKEN_CREATED',
      tokenId: token.id,
      contextType: input.contextType,
      contextId: input.contextId,
      token: token.token,
    });

    return token;
  }

  async revokeToken(tenantId: string, tokenId: string): Promise<void> {
    await checkinTokenRepository.revokeToken(tenantId, tokenId);

    await this.recordAudit(tenantId, {
      eventType: 'CHECKIN_TOKEN_REVOKED',
      tokenId,
    });
  }

  async checkInByToken(tenantId: string, input: CheckInByTokenInput): Promise<{
    checkin: Checkin;
    benefitsApplied: number;
  }> {
    // 1. Validar token
    const token = await checkinTokenRepository.getTokenByValue(tenantId, input.token);
    if (!token) {
      throw new Error('Token de check-in inválido');
    }

    if (token.status !== 'ACTIVE') {
      throw new Error(`Token não está ativo (status: ${token.status})`);
    }

    // Validar valid_from/valid_to
    const now = new Date();
    if (token.validFrom && now < token.validFrom) {
      throw new Error('Token ainda não é válido');
    }
    if (token.validTo && now > token.validTo) {
      throw new Error('Token expirado');
    }

    // 2. Criar check-in (idempotente)
    const checkin = await checkinRepository.createCheckin(
      tenantId,
      token.contextType,
      token.contextId,
      input.contactId,
      'QR',
      token.id,
      input.referenceEventId || null
    );

    // 3. Marcar presença como ATTENDED
    await presenceRepository.markAsAttended(
      tenantId,
      token.contextType,
      token.contextId,
      input.contactId
    );

    // 4. Aplicar benefícios promocionais (se houver)
    let benefitsApplied = 0;
    try {
      const { promoBenefitService } = await import('./promo-benefit.service');
      benefitsApplied = await promoBenefitService.applyBenefitOnCheckIn(
        tenantId,
        token.contextType,
        token.contextId,
        input.contactId,
        checkin.id
      );
    } catch (benefitError) {
      // Log mas não bloqueia check-in
      console.warn('[CheckinService] Erro ao aplicar benefícios promocionais:', benefitError);
    }

    await this.recordAudit(tenantId, {
      eventType: 'CHECKIN_SUCCESS',
      checkinId: checkin.id,
      contextType: token.contextType,
      contextId: token.contextId,
      contactId: input.contactId,
      tokenId: token.id,
    });

    return { checkin, benefitsApplied };
  }

  async manualCheckIn(tenantId: string, input: ManualCheckInInput): Promise<{
    checkin: Checkin;
    benefitsApplied: number;
  }> {
    // Criar check-in manual
    const checkin = await checkinRepository.createCheckin(
      tenantId,
      input.contextType,
      input.contextId,
      input.contactId,
      'MANUAL',
      null,
      null
    );

    // Marcar presença como ATTENDED
    await presenceRepository.markAsAttended(
      tenantId,
      input.contextType,
      input.contextId,
      input.contactId
    );

    // Aplicar benefícios promocionais (se houver)
    let benefitsApplied = 0;
    try {
      const { promoBenefitService } = await import('./promo-benefit.service');
      benefitsApplied = await promoBenefitService.applyBenefitOnCheckIn(
        tenantId,
        input.contextType,
        input.contextId,
        input.contactId,
        checkin.id
      );
    } catch (benefitError) {
      // Log mas não bloqueia check-in
      console.warn('[CheckinService] Erro ao aplicar benefícios promocionais:', benefitError);
    }

    await this.recordAudit(tenantId, {
      eventType: 'CHECKIN_SUCCESS',
      checkinId: checkin.id,
      contextType: input.contextType,
      contextId: input.contextId,
      contactId: input.contactId,
      checkinType: 'MANUAL',
    });

    return { checkin, benefitsApplied };
  }

  async checkOut(
    tenantId: string,
    contextType: PresenceContextType,
    contextId: string,
    contactId: string
  ): Promise<Checkin> {
    const checkout = await checkinRepository.createCheckout(tenantId, contextType, contextId, contactId);

    await this.recordAudit(tenantId, {
      eventType: 'CHECKOUT_SUCCESS',
      checkinId: checkout.id,
      contextType,
      contextId,
      contactId,
    });

    return checkout;
  }

  async getAttendanceStats(
    tenantId: string,
    contextType: PresenceContextType,
    contextId: string
  ): Promise<{
    confirmed: number;
    attended: number;
    noShow: number;
    noShowRate: number;
    cancelled: number;
  }> {
    return await presenceRepository.getAttendanceStats(tenantId, contextType, contextId);
  }

  private async recordAudit(tenantId: string, data: Record<string, any>): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, {
        event_type: (data.eventType as string) ?? 'CHECKIN_EVENT',
        severity: 'WARNING',
        source: 'impact',
        context: data,
      });
    } catch (error) {
      console.warn('[CheckinService] Erro ao registrar auditoria:', error);
    }
  }
}

export const checkinService = new CheckinService();





