// backend/src/modules/contextual-messaging/contextual-thread.service.ts
// Service para Mensageria Contextual
// 🔴 BLINDAGEM: NÃO toma decisões automáticas
// 🔴 BLINDAGEM: NÃO muda status automaticamente
// 🔴 BLINDAGEM: Comunicação apenas informativa

import { contextualThreadRepository } from './contextual-thread.repository';
import { NotFoundError, BadRequestError } from '@core/errors';
import type {
  ContextualThread,
  ContextualMessage,
  CreateContextualThreadInput,
  SendContextualMessageInput,
  ContextualThreadFilters,
} from './contextual-thread.types';

class ContextualThreadService {
  /**
   * Criar ou obter thread para um contexto
   * Se já existir uma thread para o contexto, retorna ela
   */
  async getOrCreateThread(
    tenantId: string,
    input: CreateContextualThreadInput
  ): Promise<ContextualThread> {
    // Tentar buscar thread existente
    const existing = await contextualThreadRepository.findThreadByContext(
      tenantId,
      input.contextType,
      input.contextId
    );

    if (existing) {
      // Adicionar novos participantes se necessário
      const newParticipants = input.participantActorIds.filter(
        (id) => !existing.participantActorIds.includes(id)
      );

      if (newParticipants.length > 0) {
        for (const actorId of newParticipants) {
          await contextualThreadRepository.addParticipant(tenantId, existing.threadId, actorId);
        }
        // Buscar thread atualizada
        const updated = await contextualThreadRepository.findThreadById(tenantId, existing.threadId);
        return updated || existing;
      }

      return existing;
    }

    // Criar nova thread
    return await contextualThreadRepository.createThread(tenantId, input);
  }

  /**
   * Criar thread manualmente
   */
  async createThread(
    tenantId: string,
    input: CreateContextualThreadInput
  ): Promise<ContextualThread> {
    if (!input.participantActorIds || input.participantActorIds.length === 0) {
      throw new BadRequestError('Thread deve ter pelo menos um participante');
    }

    return await contextualThreadRepository.createThread(tenantId, input);
  }

  /**
   * Buscar thread por ID
   */
  async getThreadById(tenantId: string, threadId: string): Promise<ContextualThread> {
    const thread = await contextualThreadRepository.findThreadById(tenantId, threadId);
    if (!thread) {
      throw new NotFoundError(`Thread não encontrada: ${threadId}`);
    }
    return thread;
  }

  /**
   * Buscar thread por contexto
   */
  async getThreadByContext(
    tenantId: string,
    contextType: string,
    contextId: string
  ): Promise<ContextualThread | null> {
    return await contextualThreadRepository.findThreadByContext(tenantId, contextType, contextId);
  }

  /**
   * Listar threads com filtros
   */
  async listThreads(
    tenantId: string,
    filters: ContextualThreadFilters = {}
  ): Promise<{ threads: ContextualThread[]; total: number }> {
    return await contextualThreadRepository.findThreads(tenantId, filters);
  }

  /**
   * Adicionar participante à thread
   */
  async addParticipant(
    tenantId: string,
    threadId: string,
    actorId: string
  ): Promise<ContextualThread> {
    const thread = await this.getThreadById(tenantId, threadId);
    return await contextualThreadRepository.addParticipant(tenantId, threadId, actorId);
  }

  /**
   * Enviar mensagem em thread
   */
  async sendMessage(
    tenantId: string,
    threadId: string,
    input: SendContextualMessageInput,
    senderActorId: string,
    senderUserId?: string | null
  ): Promise<ContextualMessage> {
    // 0. Verificar rate limit
    try {
      const { businessRateLimitService } = await import('@core/rate-limiting/business-rate-limit.service');
      const rateLimit = await businessRateLimitService.checkRateLimit(
        tenantId,
        senderActorId,
        'message:send',
        threadId
      );
      if (!rateLimit.allowed) {
        const { RateLimitError } = await import('@core/errors');
        throw new RateLimitError(
          `Limite de envio de mensagens excedido. Tente novamente após ${rateLimit.resetAt.toISOString()}`,
          rateLimit.resetAt,
          rateLimit.remaining
        );
      }
    } catch (rateLimitError: any) {
      if (rateLimitError.statusCode === 429) {
        throw rateLimitError;
      }
      console.warn('[ContextualThread] Erro ao verificar rate limit (não bloqueante):', rateLimitError);
    }

    // 1. Validar que thread existe
    const thread = await this.getThreadById(tenantId, threadId);

    // 2. Validar que sender é participante
    if (!thread.participantActorIds.includes(senderActorId)) {
      throw new BadRequestError('Apenas participantes podem enviar mensagens');
    }

    // Validar conteúdo
    if (!input.content || input.content.trim().length === 0) {
      throw new BadRequestError('Mensagem não pode estar vazia');
    }

    const message = await contextualThreadRepository.createMessage(
      tenantId,
      threadId,
      input,
      senderActorId,
      senderUserId
    );

    // 🔴 BLINDAGEM: Detectar bypass em mensagem (não bloqueia, apenas registra)
    try {
      const { bypassDetectionService } = await import('../bypass-detection/bypass-detection.service');
      const detection = await bypassDetectionService.detectMessageBypass(
        tenantId,
        senderActorId,
        input.content,
        thread.contextType,
        thread.contextId
      );

      if (detection.detected) {
        // Bypass detectado: já foi registrado no Evidence Pack e Trust Engine
        // Não bloqueia a mensagem (não censura), apenas registra
        console.warn(`[BypassDetection] Bypass detectado em mensagem: ${detection.signalType} (eventId: ${detection.eventId})`);
      }
    } catch (bypassError) {
      // Não bloquear mensagem se detecção falhar
      console.warn('[ContextualThread] Erro ao detectar bypass (não bloqueante):', bypassError);
    }

    // 🔴 INTEGRAÇÃO COM AGREEMENTS: Se mensagem for proposta ou confirmação, atualizar agreement
    // Mensagens de negociação podem atualizar Agreement Draft via metadata
    const messageType = input.metadata?.negotiationType as string | undefined;
    if (messageType === 'proposal' || messageType === 'confirmation') {
      try {
        const { agreementRepository } = await import('../agreements/agreement.repository');
        // Buscar agreement vinculado a esta thread
        const agreements = await agreementRepository.list(tenantId, {
          threadId,
          limit: 1,
        });

        if (agreements.length > 0) {
          const agreement = agreements[0];
          
          // Se mensagem for proposta, atualizar agreement com dados da proposta
          if (messageType === 'proposal' && input.metadata?.agreementData) {
            const agreementData = input.metadata.agreementData as any;
            await agreementRepository.update(tenantId, agreement.agreementId, {
              priceCents: agreementData.priceCents,
              currency: agreementData.currency || agreement.currency,
              scope: agreementData.scope || agreement.scope,
              includedItems: agreementData.includedItems || agreement.includedItems,
              excludedItems: agreementData.excludedItems || agreement.excludedItems,
              responsibilities: agreementData.responsibilities || agreement.responsibilities,
              capacityAssumptions: agreementData.capacityAssumptions || agreement.capacityAssumptions,
            });

            // Se status for DRAFT, mudar para PROPOSED
            if (agreement.status === 'DRAFT') {
              await agreementRepository.updateStatus(tenantId, agreement.agreementId, 'PROPOSED');
            }
          }

          // Se mensagem for confirmação, mudar status para ACCEPTED
          if (messageType === 'confirmation' && agreement.status === 'PROPOSED') {
            await agreementRepository.updateStatus(tenantId, agreement.agreementId, 'ACCEPTED');
          }
        }
      } catch (agreementError) {
        // Não bloquear envio de mensagem se atualização de agreement falhar
        console.warn('[ContextualThread] Erro ao atualizar agreement via mensagem (não bloqueante):', agreementError);
      }
    }

    // Criar notificações para outros participantes (não bloqueante)
    try {
      const { createNotificationSafely } = await import('../system-notifications/system-notification.helpers');
      const otherParticipants = thread.participantActorIds.filter(id => id !== senderActorId);
      
      for (const participantId of otherParticipants) {
        await createNotificationSafely(tenantId, {
          recipientActorId: participantId,
          type: 'message_received',
          contextType: thread.contextType,
          contextId: thread.contextId,
          message: `Nova mensagem na conversa sobre ${thread.contextType}`,
          metadata: {
            threadId,
            messageId: message.messageId,
            senderActorId,
          },
        });
      }
    } catch (notificationError) {
      console.error('Erro ao criar notificações para mensagem:', notificationError);
    }

    return message;
  }

  /**
   * Listar mensagens de uma thread
   */
  async getMessages(
    tenantId: string,
    threadId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ messages: ContextualMessage[]; total: number }> {
    // Validar que thread existe
    await this.getThreadById(tenantId, threadId);

    return await contextualThreadRepository.findMessages(tenantId, threadId, limit, offset);
  }
}

export const contextualThreadService = new ContextualThreadService();

