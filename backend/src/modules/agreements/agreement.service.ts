// backend/src/modules/agreements/agreement.service.ts
// Service para Negociação Assistida e Registro de Acordos
// 🔴 BLINDAGEM: Nenhum booking/bundle/service-order sem acordo FINALIZED
// 🔴 BLINDAGEM: Valor final vem do acordo, não do frontend

import { agreementRepository } from './agreement.repository';
import type {
  Agreement,
  CreateAgreementInput,
  UpdateAgreementInput,
  ProposeAgreementInput,
  AcceptAgreementInput,
  FinalizeAgreementInput,
  AgreementFilters,
} from './agreement.types';
import { BadRequestError, NotFoundError, ConflictError } from '@core/errors';
import { recordBusinessAuditSafely } from '../business-audit/business-audit.helpers';

class AgreementService {
  /**
   * Cria um novo Agreement Draft
   * 🔴 BLINDAGEM: Sempre inicia como DRAFT
   */
  async createAgreement(
    tenantId: string,
    userId: string,
    input: CreateAgreementInput
  ): Promise<Agreement> {
    // Validar que não existe agreement finalizado para este contexto
    const existing = await agreementRepository.findFinalizedByContext(
      tenantId,
      input.contextType,
      input.contextId
    );

    if (existing) {
      throw new ConflictError('Já existe um acordo finalizado para este contexto');
    }

    const agreement = await agreementRepository.create(tenantId, input, userId);

    // Registrar audit log
    await recordBusinessAuditSafely(tenantId, {
      action: 'agreement_created',
      actorId: input.requesterActorId,
      userId,
      contextType: input.contextType as any,
      contextId: input.contextId,
      metadata: {
        agreementId: agreement.agreementId,
        priceCents: agreement.priceCents,
        currency: agreement.currency,
      },
    });

    return agreement;
  }

  /**
   * Busca agreement por ID
   */
  async getAgreement(tenantId: string, agreementId: string): Promise<Agreement> {
    const agreement = await agreementRepository.findById(tenantId, agreementId);
    if (!agreement) {
      throw new NotFoundError('Agreement não encontrado');
    }
    return agreement;
  }

  /**
   * Lista agreements com filtros
   */
  async listAgreements(tenantId: string, filters: AgreementFilters = {}): Promise<Agreement[]> {
    return agreementRepository.list(tenantId, filters);
  }

  /**
   * Busca agreement finalizado por contexto
   * 🔴 BLINDAGEM: Usado para validar se pode criar booking/bundle/service-order
   */
  async getFinalizedAgreementByContext(
    tenantId: string,
    contextType: string,
    contextId: string
  ): Promise<Agreement | null> {
    return agreementRepository.findFinalizedByContext(tenantId, contextType, contextId);
  }

  /**
   * Atualiza Agreement Draft
   * 🔴 BLINDAGEM: Só pode atualizar se status for DRAFT ou PROPOSED
   */
  async updateAgreement(
    tenantId: string,
    userId: string,
    agreementId: string,
    input: UpdateAgreementInput
  ): Promise<Agreement> {
    const agreement = await this.getAgreement(tenantId, agreementId);

    // Não pode atualizar se já estiver ACCEPTED ou FINALIZED
    if (agreement.status === 'ACCEPTED' || agreement.status === 'FINALIZED') {
      throw new ConflictError('Não é possível atualizar um acordo já aceito ou finalizado');
    }

    const updated = await agreementRepository.update(tenantId, agreementId, input);

    // Registrar audit log
    await recordBusinessAuditSafely(tenantId, {
      action: 'agreement_updated',
      actorId: agreement.requesterActorId,
      userId,
      contextType: 'agreement' as any,
      contextId: agreementId,
      metadata: {
        changes: Object.keys(input),
        previousPriceCents: agreement.priceCents,
        newPriceCents: updated.priceCents,
      },
    });

    return updated;
  }

  /**
   * Propõe acordo (muda status para PROPOSED)
   * 🔴 BLINDAGEM: Requer que status seja DRAFT
   */
  async proposeAgreement(
    tenantId: string,
    userId: string,
    agreementId: string,
    input: ProposeAgreementInput
  ): Promise<Agreement> {
    const agreement = await this.getAgreement(tenantId, agreementId);

    if (agreement.status !== 'DRAFT') {
      throw new ConflictError('Apenas acordos em DRAFT podem ser propostos');
    }

    const updated = await agreementRepository.updateStatus(tenantId, agreementId, 'PROPOSED');

    // Registrar audit log
    await recordBusinessAuditSafely(tenantId, {
      action: 'agreement_proposed',
      actorId: agreement.requesterActorId,
      userId,
      contextType: 'agreement' as any,
      contextId: agreementId,
      metadata: {
        messageId: input.messageId,
      },
    });

    return updated;
  }

  /**
   * Aceita acordo (muda status para ACCEPTED)
   * 🔴 BLINDAGEM: Requer que status seja PROPOSED
   * 🔴 BLINDAGEM: Ambos os actors devem aceitar explicitamente
   */
  async acceptAgreement(
    tenantId: string,
    userId: string,
    agreementId: string,
    input: AcceptAgreementInput
  ): Promise<Agreement> {
    const agreement = await this.getAgreement(tenantId, agreementId);

    if (agreement.status !== 'PROPOSED') {
      throw new ConflictError('Apenas acordos em PROPOSED podem ser aceitos');
    }

    // Validar que o actor que está aceitando é um dos participantes
    if (
      input.actorId !== agreement.requesterActorId &&
      input.actorId !== agreement.providerActorId
    ) {
      throw new BadRequestError('Apenas os participantes do acordo podem aceitá-lo');
    }

    const updated = await agreementRepository.updateStatus(tenantId, agreementId, 'ACCEPTED');

    // Registrar audit log
    await recordBusinessAuditSafely(tenantId, {
      action: 'agreement_accepted',
      actorId: input.actorId,
      userId,
      contextType: 'agreement' as any,
      contextId: agreementId,
      metadata: {
        messageId: input.messageId,
        acceptedBy: input.actorId === agreement.requesterActorId ? 'requester' : 'provider',
      },
    });

    return updated;
  }

  /**
   * Finaliza acordo (muda status para FINALIZED)
   * 🔴 BLINDAGEM: Requer que status seja ACCEPTED
   * 🔴 BLINDAGEM: Ambos os actors devem ter aceitado (verificado por status ACCEPTED)
   */
  async finalizeAgreement(
    tenantId: string,
    userId: string,
    agreementId: string,
    input: FinalizeAgreementInput
  ): Promise<Agreement> {
    const agreement = await this.getAgreement(tenantId, agreementId);

    if (agreement.status !== 'ACCEPTED') {
      throw new ConflictError('Apenas acordos em ACCEPTED podem ser finalizados');
    }

    // Validar que o actor que está finalizando é um dos participantes
    if (
      input.actorId !== agreement.requesterActorId &&
      input.actorId !== agreement.providerActorId
    ) {
      throw new BadRequestError('Apenas os participantes do acordo podem finalizá-lo');
    }

    const updated = await agreementRepository.updateStatus(
      tenantId,
      agreementId,
      'FINALIZED',
      input.actorId
    );

    // Registrar audit log
    await recordBusinessAuditSafely(tenantId, {
      action: 'agreement_finalized',
      actorId: input.actorId,
      userId,
      contextType: 'agreement' as any,
      contextId: agreementId,
      metadata: {
        finalizedBy: input.actorId === agreement.requesterActorId ? 'requester' : 'provider',
        priceCents: agreement.priceCents,
        currency: agreement.currency,
      },
    });

    // 🔴 BLINDAGEM: Registrar evento de trust positivo (agreement respeitado)
    try {
      const { trustEngineService } = await import('../trust/trust-engine.service');
      const { evidenceService } = await import('../evidence/evidence.service');
      
      // Buscar evidence pack do agreement
      const evidencePack = await evidenceService.getPackByContext(
        tenantId,
        'agreement',
        agreementId
      );

      if (evidencePack) {
        // Registrar para ambos os actors (requester e provider)
        await trustEngineService.registerTrustEvent(tenantId, {
          actorId: agreement.requesterActorId,
          eventType: 'agreement_respected',
          severity: 'LOW',
          contextType: 'agreement',
          contextId: agreementId,
          evidencePackId: evidencePack.packId,
        });

        await trustEngineService.registerTrustEvent(tenantId, {
          actorId: agreement.providerActorId,
          eventType: 'agreement_respected',
          severity: 'LOW',
          contextType: 'agreement',
          contextId: agreementId,
          evidencePackId: evidencePack.packId,
        });
      }
    } catch (trustError) {
      console.warn('[Agreement] Erro ao registrar evento de trust (não bloqueante):', trustError);
    }

    return updated;
  }

  /**
   * Valida se pode criar booking/bundle/service-order
   * 🔴 BLINDAGEM: Deve existir agreement FINALIZED
   * 🔴 BLINDAGEM: Valor deve corresponder ao acordo
   */
  async validateAgreementForClosure(
    tenantId: string,
    contextType: string,
    contextId: string,
    expectedPriceCents: number
  ): Promise<{ valid: boolean; agreement: Agreement | null; error?: string }> {
    const agreement = await agreementRepository.findFinalizedByContext(
      tenantId,
      contextType,
      contextId
    );

    if (!agreement) {
      return {
        valid: false,
        agreement: null,
        error: 'Não existe acordo finalizado para este contexto',
      };
    }

    // Validar que o valor corresponde ao acordo
    if (agreement.priceCents !== expectedPriceCents) {
        // Registrar tentativa de bypass
        await recordBusinessAuditSafely(tenantId, {
          action: 'agreement_bypass_attempted',
          actorId: agreement.requesterActorId,
          userId: null,
          contextType: contextType as any,
          contextId,
          metadata: {
            agreementPriceCents: agreement.priceCents,
            attemptedPriceCents: expectedPriceCents,
            agreementId: agreement.agreementId,
          },
        });

        // 🔴 BLINDAGEM: Detectar e registrar bypass de valor
        try {
          const { bypassDetectionService } = await import('../bypass-detection/bypass-detection.service');
          await bypassDetectionService.detectValueBypass(
            tenantId,
            agreement.requesterActorId,
            expectedPriceCents,
            agreement.priceCents,
            contextType as any,
            contextId
          );
        } catch (bypassError) {
          console.warn('[Agreement] Erro ao detectar bypass (não bloqueante):', bypassError);
        }

      return {
        valid: false,
        agreement,
        error: `Valor do acordo (${agreement.priceCents}) não corresponde ao valor informado (${expectedPriceCents})`,
      };
    }

    return {
      valid: true,
      agreement,
    };
  }
}

export const agreementService = new AgreementService();

