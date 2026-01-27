// src/modules/dispatch/opportunity-dispatch.service.ts
// Service do Domínio de DISPATCH DE OPORTUNIDADES
// 🔴 BLINDAGEM: Dispatch é NOTIFICAÇÃO, não decisão
// 🔴 BLINDAGEM: NÃO faz matching
// 🔴 BLINDAGEM: NÃO prioriza
// 🔴 BLINDAGEM: NÃO escolhe "melhor"
// 🔴 BLINDAGEM: Apenas NOTIFICA quem PODE atuar
// 🔴 BLINDAGEM: Critérios: mesmo território, mesmo tipo de atuação, mesmo interesse declarado
// 🔴 BLINDAGEM: NUNCA educação, NUNCA score

import { opportunityDispatchRepository } from './opportunity-dispatch.repository';
import { actorRepository } from '@modules/social/actor.repository';
import { BadRequestError, NotFoundError, ForbiddenError } from '@core/errors';
import type {
  OpportunityDispatch,
  CreateOpportunityDispatchInput,
  RespondToDispatchInput,
  OpportunityDispatchFilters,
  OpportunityType,
} from './opportunity-dispatch.types';
import { DispatchResponse } from './opportunity-dispatch.types';

class OpportunityDispatchService {
  /**
   * Cria um novo dispatch de oportunidade
   * 🔴 BLINDAGEM: Dispatch é NOTIFICAÇÃO, não decisão
   * 🔴 BLINDAGEM: Apenas NOTIFICA quem PODE atuar
   */
  async createDispatch(
    tenantId: string,
    userId: string,
    input: CreateOpportunityDispatchInput
  ): Promise<OpportunityDispatch> {
    // 🔴 BLINDAGEM: Validar que todos os IDs foram fornecidos
    if (!input.opportunityId) {
      throw new BadRequestError('opportunityId é obrigatório para criar dispatch');
    }
    if (!input.opportunityType) {
      throw new BadRequestError('opportunityType é obrigatório para criar dispatch');
    }
    if (!input.targetActorId) {
      throw new BadRequestError('targetActorId é obrigatório para criar dispatch');
    }

    // 🔴 BLINDAGEM: Validar que target actor existe
    const targetActor = await actorRepository.findById(tenantId, input.targetActorId);
    if (!targetActor) {
      throw new NotFoundError('Actor alvo não encontrado');
    }

    // 🔴 BLINDAGEM: Criar dispatch (apenas notificação, não decisão)
    const dispatch = await opportunityDispatchRepository.create(tenantId, input);

    // 🔴 BLINDAGEM: Emitir effect canônico após criar dispatch
    // O sistema NÃO decide o que acontece depois, apenas emite o fato
    try {
      const { eventBus } = await import('@core/events/event-bus');
      const { v4: uuidv4 } = await import('uuid');
      const { ActorEffect } = await import('@modules/social/actor-effects.types');
      
      await eventBus.publish({
        eventId: uuidv4(),
        tenantId,
        type: ActorEffect.OPPORTUNITY_DISPATCHED,
        version: 1,
        payload: {
          actorId: dispatch.targetActorId,
          actorType: targetActor.actor_type as any,
          intent: 'DISPATCH_OPPORTUNITY',
          sourceId: dispatch.dispatchId,
          sourceType: 'opportunity_dispatch',
          metadata: {
            opportunityId: dispatch.opportunityId,
            opportunityType: dispatch.opportunityType,
            contextType: input.metadata?.contextType || null, // Preservar contextType se fornecido (ex: 'rfq')
          },
        },
        metadata: {
          userId: userId,
          dispatchId: dispatch.dispatchId,
          opportunityId: dispatch.opportunityId,
        },
      });
    } catch (error) {
      console.error('Erro ao emitir effect OPPORTUNITY_DISPATCHED (não crítico):', error);
    }

    return dispatch;
  }

  /**
   * Busca dispatch por ID
   */
  async getDispatch(tenantId: string, dispatchId: string): Promise<OpportunityDispatch> {
    const dispatch = await opportunityDispatchRepository.findById(tenantId, dispatchId);
    if (!dispatch) {
      throw new NotFoundError('Dispatch não encontrado');
    }
    return dispatch;
  }

  /**
   * Lista dispatches com filtros
   * 🔴 BLINDAGEM: Nenhuma ordenação por score ou prioridade
   */
  async listDispatches(
    tenantId: string,
    filters: OpportunityDispatchFilters
  ): Promise<OpportunityDispatch[]> {
    return opportunityDispatchRepository.find(tenantId, filters);
  }

  /**
   * Responde a um dispatch
   * 🔴 BLINDAGEM: Aceitar não garante nada
   * 🔴 BLINDAGEM: Rejeitar não penaliza
   * 🔴 BLINDAGEM: Expirar não gera score
   */
  async respondToDispatch(
    tenantId: string,
    dispatchId: string,
    userId: string,
    input: RespondToDispatchInput
  ): Promise<OpportunityDispatch> {
    // 🔴 BLINDAGEM: Validar que dispatch existe
    const dispatch = await opportunityDispatchRepository.findById(tenantId, dispatchId);
    if (!dispatch) {
      throw new NotFoundError('Dispatch não encontrado');
    }

    // 🔴 BLINDAGEM: Validar que target actor existe
    const targetActor = await actorRepository.findById(tenantId, dispatch.targetActorId);
    if (!targetActor) {
      throw new NotFoundError('Actor alvo não encontrado');
    }

    // 🔴 BLINDAGEM: Validação de ownership pode ser feita em camada superior
    // Por enquanto, permitimos que qualquer usuário autenticado responda
    // (a validação de ownership pode ser implementada quando necessário)

    // 🔴 BLINDAGEM: Validar que dispatch ainda não foi respondido
    if (dispatch.response) {
      throw new BadRequestError('Dispatch já foi respondido');
    }

    // 🔴 BLINDAGEM: Atualizar resposta (não garante nada, não penaliza, não gera score)
    const updatedDispatch = await opportunityDispatchRepository.updateResponse(
      tenantId,
      dispatchId,
      input
    );

    // 🔴 BLINDAGEM: Emitir effect canônico após responder dispatch
    // O sistema NÃO decide o que acontece depois, apenas emite o fato
    try {
      const { eventBus } = await import('@core/events/event-bus');
      const { v4: uuidv4 } = await import('uuid');
      const { ActorEffect } = await import('@modules/social/actor-effects.types');
      
      await eventBus.publish({
        eventId: uuidv4(),
        tenantId,
        type: ActorEffect.OPPORTUNITY_DISPATCH_RESPONDED,
        version: 1,
        payload: {
          actorId: updatedDispatch.targetActorId,
          actorType: targetActor.actor_type as any,
          intent: 'RESPOND_TO_DISPATCH',
          sourceId: updatedDispatch.dispatchId,
          sourceType: 'opportunity_dispatch',
          metadata: {
            opportunityId: updatedDispatch.opportunityId,
            opportunityType: updatedDispatch.opportunityType,
            response: updatedDispatch.response,
          },
        },
        metadata: {
          userId: userId,
          dispatchId: updatedDispatch.dispatchId,
          opportunityId: updatedDispatch.opportunityId,
        },
      });
    } catch (error) {
      console.error('Erro ao emitir effect OPPORTUNITY_DISPATCH_RESPONDED (não crítico):', error);
    }

    return updatedDispatch;
  }
}

export const opportunityDispatchService = new OpportunityDispatchService();

