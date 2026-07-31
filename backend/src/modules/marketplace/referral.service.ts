// backend/src/modules/marketplace/referral.service.ts
// SPRINT 74: GROUPS, INDICAÇÕES E COMISSÕES

import { referralRepository } from './referral.repository';
import type { ReferralCode, CreateReferralCodeInput, ResolvedReferralCode } from './referral.types';

class ReferralService {
  async createCode(
    tenantId: string,
    input: CreateReferralCodeInput,
    createdByActorId: string,
    createdByUserId?: string
  ): Promise<ReferralCode> {
    // Validar grupo se fornecido
    if (input.groupId) {
      const { groupService } = await import('./group.service');
      const group = await groupService.getGroupById(tenantId, input.groupId);
      if (!group) {
        throw new Error(`Grupo não encontrado: ${input.groupId}`);
      }
    }

    // Verificar se código já existe
    const existing = await referralRepository.resolveCode(tenantId, input.code);
    if (existing) {
      throw new Error(`Código de indicação já existe: ${input.code}`);
    }

    const referralCode = await referralRepository.createCode(tenantId, {
      code: input.code,
      ownerActorId: input.ownerActorId,
      groupId: input.groupId || null,
      createdByActorId,
      createdByUserId: createdByUserId || null,
      metadata: input.metadata || {},
    });

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'REFERRAL_CODE_CREATED',
      referralCodeId: referralCode.id,
      code: referralCode.code,
      createdByActorId,
      createdByUserId,
    });

    return referralCode;
  }

  async resolveCode(tenantId: string, code: string): Promise<ResolvedReferralCode | null> {
    const referralCode = await referralRepository.resolveCode(tenantId, code);
    if (!referralCode) {
      return null;
    }

    return {
      referralCode,
      ownerActorId: referralCode.ownerActorId,
      groupId: referralCode.groupId,
    };
  }

  private async recordAudit(
    tenantId: string,
    data: {
      eventType: string;
      referralCodeId: string;
      code: string;
      createdByActorId: string;
      createdByUserId?: string | null;
    }
  ): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, {
        event_type: data.eventType,
        severity: 'INFO',
        actor_id: data.createdByActorId,
        actor_type: 'user',
        source: 'validation',
        context: {
          referral_code_id: data.referralCodeId,
          code: data.code,
          created_by_user_id: data.createdByUserId,
        },
      });
    } catch (error) {
      console.warn('[Referral] Erro ao registrar auditoria:', error);
    }
  }
}

export const referralService = new ReferralService();






