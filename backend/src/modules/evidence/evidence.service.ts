// backend/src/modules/evidence/evidence.service.ts
// Service para Evidências & Resolução de Disputas
// 🔴 BLINDAGEM: Append-only, imutável, sem decisões automáticas

import { evidenceRepository } from './evidence.repository';
import type {
  EvidencePack,
  CreateEvidencePackInput,
  EvidenceEvent,
  OpenDisputeInput,
  ResolveDisputeInput,
  EvidencePackFilters,
} from './evidence.types';
import { NotFoundError, ConflictError } from '@core/errors';
import { recordBusinessAuditSafely } from '../business-audit/business-audit.helpers';

class EvidenceService {
  /**
   * Cria ou obtém evidence pack para um contexto
   */
  async getOrCreatePack(
    tenantId: string,
    input: CreateEvidencePackInput
  ): Promise<EvidencePack> {
    return evidenceRepository.getOrCreatePack(tenantId, input);
  }

  /**
   * Busca evidence pack por contexto
   */
  async getPackByContext(
    tenantId: string,
    contextType: string,
    contextId: string
  ): Promise<EvidencePack | null> {
    return evidenceRepository.findByContext(tenantId, contextType, contextId);
  }

  /**
   * Busca evidence pack por ID
   */
  async getPack(tenantId: string, packId: string): Promise<EvidencePack> {
    const pack = await evidenceRepository.findById(tenantId, packId);
    if (!pack) {
      throw new NotFoundError('Evidence pack não encontrado');
    }
    return pack;
  }

  /**
   * Lista evidence packs com filtros
   */
  async listPacks(tenantId: string, filters: EvidencePackFilters = {}): Promise<EvidencePack[]> {
    return evidenceRepository.list(tenantId, filters);
  }

  /**
   * Adiciona evento à timeline (append-only)
   * 🔴 BLINDAGEM: Não remove eventos, apenas adiciona
   */
  async addEvent(
    tenantId: string,
    packId: string,
    event: EvidenceEvent
  ): Promise<EvidencePack> {
    const pack = await this.getPack(tenantId, packId);
    
    // Adicionar evento
    const updated = await evidenceRepository.addEvent(tenantId, packId, event);

    // Registrar audit log
    await recordBusinessAuditSafely(tenantId, {
      action: 'evidence_event_added',
      actorId: event.actorId,
      userId: event.userId || null,
      contextType: 'agreement' as any, // TODO: mapear corretamente
      contextId: packId,
      metadata: {
        eventType: event.eventType,
        source: event.source,
      },
    });

    return updated;
  }

  /**
   * Abre disputa
   */
  async openDispute(
    tenantId: string,
    packId: string,
    input: OpenDisputeInput
  ): Promise<EvidencePack> {
    const pack = await this.getPack(tenantId, packId);

    if (pack.disputeStatus !== 'NONE') {
      throw new ConflictError('Disputa já está aberta ou em mediação');
    }

    const updated = await evidenceRepository.updateDisputeStatus(
      tenantId,
      packId,
      'OPEN',
      new Date(),
      null
    );

    // Adicionar evento de abertura de disputa
    const { randomUUID } = await import('crypto');
    const eventId = randomUUID();
    await this.addEvent(tenantId, packId, {
      eventId,
      eventType: 'dispute_opened',
      timestamp: new Date(),
      actorId: input.openedByActorId,
      userId: input.openedByUserId || null,
      data: {
        reason: input.reason,
      },
      source: 'system',
      sourceId: null,
    });

    // Registrar audit log
    await recordBusinessAuditSafely(tenantId, {
      action: 'dispute_opened',
      actorId: input.openedByActorId,
      userId: input.openedByUserId || null,
      contextType: 'agreement' as any,
      contextId: packId,
      metadata: {
        reason: input.reason,
      },
    });

    // 🔴 BLINDAGEM: Registrar evento de trust negativo (disputa aberta)
    try {
      const { trustEngineService } = await import('../trust/trust-engine.service');
      await trustEngineService.registerTrustEvent(tenantId, {
        actorId: input.openedByActorId,
        eventType: 'dispute_opened',
        severity: 'WARNING',
        contextType: pack.contextType as any,
        contextId: pack.contextId,
        evidencePackId: packId,
        metadata: {
          reason: input.reason,
        },
      });
    } catch (trustError) {
      console.warn('[Evidence] Erro ao registrar evento de trust (não bloqueante):', trustError);
    }

    return updated;
  }

  /**
   * Resolve disputa
   */
  async resolveDispute(
    tenantId: string,
    packId: string,
    input: ResolveDisputeInput
  ): Promise<EvidencePack> {
    const pack = await this.getPack(tenantId, packId);

    if (pack.disputeStatus === 'NONE') {
      throw new ConflictError('Não há disputa aberta para resolver');
    }

    if (pack.disputeStatus === 'RESOLVED') {
      throw new ConflictError('Disputa já foi resolvida');
    }

    const updated = await evidenceRepository.updateDisputeStatus(
      tenantId,
      packId,
      'RESOLVED',
      pack.openedAt,
      new Date()
    );

    // Adicionar evento de resolução de disputa
    const { randomUUID } = await import('crypto');
    const eventId = randomUUID();
    await this.addEvent(tenantId, packId, {
      eventId,
      eventType: 'dispute_resolved',
      timestamp: new Date(),
      actorId: input.resolvedByActorId,
      userId: input.resolvedByUserId || null,
      data: {
        resolution: input.resolution,
      },
      source: 'system',
      sourceId: null,
    });

    // Registrar audit log
    await recordBusinessAuditSafely(tenantId, {
      action: 'dispute_resolved',
      actorId: input.resolvedByActorId,
      userId: input.resolvedByUserId || null,
      contextType: 'agreement' as any,
      contextId: packId,
      metadata: {
        resolution: input.resolution,
      },
    });

    return updated;
  }

  /**
   * Consolida evidências de um contexto
   * Busca e adiciona eventos de chat, agreements, audit logs
   */
  async consolidateEvidence(
    tenantId: string,
    contextType: string,
    contextId: string
  ): Promise<EvidencePack> {
    // Obter ou criar pack
    const pack = await this.getOrCreatePack(tenantId, {
      contextType: contextType as any,
      contextId,
    });

    // TODO: Implementar consolidação de:
    // 1. Mensagens do chat contextual
    // 2. Histórico de agreements
    // 3. Audit logs relacionados
    // 4. Decisões e confirmações

    return pack;
  }
}

export const evidenceService = new EvidenceService();

