// src/core/read-models/read-model.projector.ts
// Camada de Projeção Centralizada de Read Models
// 🔴 BLINDAGEM: ReadModel não é verdade
// - ReadModel não é contrato de negócio
// - ReadModel pode ser descartado e reconstruído
// - ReadModel nunca consome intents
// - ReadModel nunca decide regra
// - Services NÃO atualizam read models manualmente

import {
  ReadModelType,
  ReadModel,
  ReadModelProjectionResult,
} from './read-model.types';
import { ActorEffect } from '@core/social/ports';
import { eventBus, type UnificardEvent } from '@core/events/event-bus';

/**
 * Mapa explícito: EFFECT → ReadModels afetados
 * 🔴 BLINDAGEM: Nada implícito, nada direto no handler
 * Tudo explícito em código
 */
const EFFECT_READ_MODEL_MAP: Record<ActorEffect, ReadModelType[]> = {
  // Feed e Conteúdo
  [ActorEffect.FEED_ITEM_CREATED]: [
    ReadModelType.FEED_READ_MODEL,
    ReadModelType.POST_READ_MODEL,
  ],
  [ActorEffect.FEED_ITEM_UPDATED]: [
    ReadModelType.FEED_READ_MODEL,
    ReadModelType.POST_READ_MODEL,
  ],
  
  // Projetos e Oportunidades
  [ActorEffect.PROJECT_CREATED]: [
    ReadModelType.FEED_READ_MODEL,
    ReadModelType.PROJECT_READ_MODEL,
    ReadModelType.PROJECT_LIST_READ_MODEL,
    ReadModelType.OPPORTUNITY_READ_MODEL,
  ],
  [ActorEffect.PROJECT_UPDATED]: [
    ReadModelType.PROJECT_READ_MODEL,
    ReadModelType.PROJECT_LIST_READ_MODEL,
  ],
  [ActorEffect.JOB_POSTED]: [
    ReadModelType.FEED_READ_MODEL,
    ReadModelType.OPPORTUNITY_READ_MODEL,
  ],
  
  // Ações Sociais
  [ActorEffect.CTA_PUBLISHED]: [
    ReadModelType.FEED_READ_MODEL,
    ReadModelType.POST_READ_MODEL,
  ],
  [ActorEffect.VOTE_REGISTERED]: [
    ReadModelType.FEED_READ_MODEL,
    ReadModelType.POST_READ_MODEL,
  ],
  [ActorEffect.COMMENT_ADDED]: [
    ReadModelType.FEED_READ_MODEL,
    ReadModelType.POST_READ_MODEL,
  ],
  
  // Economia
  [ActorEffect.PAYMENT_INITIATED]: [
    ReadModelType.GROUP_READ_MODEL,
  ],
  [ActorEffect.PAYMENT_COMPLETED]: [
    ReadModelType.GROUP_READ_MODEL,
  ],
  [ActorEffect.GROUP_FUNDS_UPDATED]: [
    ReadModelType.GROUP_READ_MODEL,
    ReadModelType.FEED_READ_MODEL,
  ],
  
  // Eventos
  [ActorEffect.EVENT_ANNOUNCED]: [
    ReadModelType.FEED_READ_MODEL,
    ReadModelType.OPPORTUNITY_READ_MODEL,
  ],
  
  // Serviços
  [ActorEffect.SERVICE_CREATED]: [
    ReadModelType.SERVICE_READ_MODEL,
    ReadModelType.SERVICE_LIST_READ_MODEL,
    ReadModelType.FEED_READ_MODEL, // Serviço pode aparecer no feed
    ReadModelType.OPPORTUNITY_READ_MODEL, // Serviço pode ser oportunidade
  ],
  [ActorEffect.SERVICE_ACTIVATED]: [
    ReadModelType.SERVICE_READ_MODEL,
    ReadModelType.SERVICE_LIST_READ_MODEL,
    ReadModelType.FEED_READ_MODEL, // Serviço ativado pode aparecer no feed
    ReadModelType.OPPORTUNITY_READ_MODEL, // Serviço ativado pode ser oportunidade
  ],
  [ActorEffect.SERVICE_UPDATED]: [
    ReadModelType.SERVICE_READ_MODEL,
    ReadModelType.SERVICE_LIST_READ_MODEL,
  ],
  [ActorEffect.SERVICE_AVAILABILITY_CREATED]: [
    ReadModelType.SERVICE_AVAILABILITY_READ_MODEL,
    ReadModelType.SERVICE_AVAILABILITY_LIST_READ_MODEL,
    ReadModelType.SERVICE_READ_MODEL, // Disponibilidade afeta serviço
  ],
  [ActorEffect.SERVICE_AVAILABILITY_UPDATED]: [
    ReadModelType.SERVICE_AVAILABILITY_READ_MODEL,
    ReadModelType.SERVICE_AVAILABILITY_LIST_READ_MODEL,
    ReadModelType.SERVICE_READ_MODEL, // Disponibilidade afeta serviço
  ],
  [ActorEffect.SERVICE_BOOKING_REQUESTED]: [
    ReadModelType.BOOKING_READ_MODEL,
    ReadModelType.BOOKING_LIST_READ_MODEL,
    ReadModelType.SERVICE_READ_MODEL, // Booking afeta serviço
    ReadModelType.FEED_READ_MODEL, // Booking pode aparecer no feed
    ReadModelType.INBOX_READ_MODEL, // Booking aparece no inbox social
    ReadModelType.INBOX_COUNTER_READ_MODEL, // Contador de inbox atualizado
  ],
  [ActorEffect.SERVICE_BOOKING_CANCELLED]: [
    ReadModelType.BOOKING_READ_MODEL,
    ReadModelType.BOOKING_LIST_READ_MODEL,
    ReadModelType.SERVICE_READ_MODEL, // Booking afeta serviço
  ],
  [ActorEffect.SERVICE_BOOKING_ACCEPTED]: [
    ReadModelType.BOOKING_DECISION_READ_MODEL,
    ReadModelType.BOOKING_READ_MODEL,
    ReadModelType.BOOKING_LIST_READ_MODEL,
    ReadModelType.SERVICE_READ_MODEL, // Decisão afeta serviço
    ReadModelType.FEED_READ_MODEL, // Decisão pode aparecer no feed
    ReadModelType.INBOX_READ_MODEL, // Decisão aparece no inbox social
    ReadModelType.INBOX_COUNTER_READ_MODEL, // Contador de inbox atualizado
  ],
  [ActorEffect.SERVICE_BOOKING_REJECTED]: [
    ReadModelType.BOOKING_DECISION_READ_MODEL,
    ReadModelType.BOOKING_READ_MODEL,
    ReadModelType.BOOKING_LIST_READ_MODEL,
    ReadModelType.SERVICE_READ_MODEL, // Decisão afeta serviço
    ReadModelType.INBOX_READ_MODEL, // Decisão aparece no inbox social
    ReadModelType.INBOX_COUNTER_READ_MODEL, // Contador de inbox atualizado
  ],
  [ActorEffect.SERVICE_PAYMENT_REQUESTED]: [
    ReadModelType.PAYMENT_READ_MODEL,
    ReadModelType.PAYMENT_LIST_READ_MODEL,
    ReadModelType.BOOKING_READ_MODEL, // Payment afeta booking
    ReadModelType.SERVICE_READ_MODEL, // Payment afeta serviço
    ReadModelType.FEED_READ_MODEL, // Payment pode aparecer no feed
    ReadModelType.ACTOR_ECONOMIC_OVERVIEW_READ_MODEL, // Payment request afeta overview econômico
    ReadModelType.INBOX_READ_MODEL, // Payment aparece no inbox social
    ReadModelType.INBOX_COUNTER_READ_MODEL, // Contador de inbox atualizado
  ],
  [ActorEffect.SERVICE_PAYMENT_CANCELLED]: [
    ReadModelType.PAYMENT_READ_MODEL,
    ReadModelType.PAYMENT_LIST_READ_MODEL,
    ReadModelType.BOOKING_READ_MODEL, // Payment afeta booking
    ReadModelType.SERVICE_READ_MODEL, // Payment afeta serviço
  ],
  [ActorEffect.SERVICE_PAYMENT_EXECUTED]: [
    ReadModelType.PAYMENT_EXECUTION_READ_MODEL,
    ReadModelType.PAYMENT_READ_MODEL,
    ReadModelType.PAYMENT_LIST_READ_MODEL,
    ReadModelType.BOOKING_READ_MODEL, // Execução afeta booking
    ReadModelType.SERVICE_READ_MODEL, // Execução afeta serviço
    ReadModelType.FEED_READ_MODEL, // Execução pode aparecer no feed
    ReadModelType.ACTOR_ECONOMIC_OVERVIEW_READ_MODEL, // Execução afeta overview econômico do payer e receiver
    ReadModelType.GROUP_ECONOMIC_OVERVIEW_READ_MODEL, // Execução pode afetar overview econômico de grupo
    ReadModelType.INBOX_READ_MODEL, // Execução aparece no inbox social
    ReadModelType.INBOX_COUNTER_READ_MODEL, // Contador de inbox atualizado
  ],
  [ActorEffect.SERVICE_PAYMENT_SPLIT_APPLIED]: [
    ReadModelType.PAYMENT_SPLIT_READ_MODEL,
    ReadModelType.PAYMENT_EXECUTION_READ_MODEL,
    ReadModelType.PAYMENT_READ_MODEL,
    ReadModelType.SERVICE_READ_MODEL, // Split afeta serviço
    ReadModelType.ACTOR_ECONOMIC_OVERVIEW_READ_MODEL, // Split afeta overview econômico do receiver
    ReadModelType.GROUP_ECONOMIC_OVERVIEW_READ_MODEL, // Split pode afetar overview econômico de grupo
  ],
  [ActorEffect.OPPORTUNITY_DISPATCHED]: [
    ReadModelType.DISPATCH_INBOX_READ_MODEL,
    ReadModelType.DISPATCH_HISTORY_READ_MODEL,
    ReadModelType.FEED_READ_MODEL, // Dispatch pode aparecer no feed
    ReadModelType.INBOX_READ_MODEL, // Dispatch aparece no inbox social
    ReadModelType.INBOX_COUNTER_READ_MODEL, // Contador de inbox atualizado
  ],
  [ActorEffect.OPPORTUNITY_DISPATCH_RESPONDED]: [
    ReadModelType.DISPATCH_INBOX_READ_MODEL,
    ReadModelType.DISPATCH_HISTORY_READ_MODEL,
    ReadModelType.INBOX_READ_MODEL, // Resposta aparece no inbox social
    ReadModelType.INBOX_COUNTER_READ_MODEL, // Contador de inbox atualizado
  ],
  
  // Reputação e Impacto
  [ActorEffect.IMPACT_RECORDED]: [
    ReadModelType.REPUTATION_READ_MODEL,
    ReadModelType.PROFILE_READ_MODEL,
  ],
  [ActorEffect.REPUTATION_UPDATED]: [
    ReadModelType.REPUTATION_READ_MODEL,
    ReadModelType.PROFILE_READ_MODEL,
  ],
  
  // Notificações
  [ActorEffect.NOTIFICATION_SENT]: [], // Notificações não afetam read models
  
  // Disponibilidade e Conflitos
  [ActorEffect.AVAILABILITY_CONFLICT_DETECTED]: [
    ReadModelType.INBOX_READ_MODEL, // Conflito aparece no inbox social
    ReadModelType.INBOX_COUNTER_READ_MODEL, // Contador de inbox atualizado
  ],
};

/**
 * Serviço de Projeção de Read Models
 */
class ReadModelProjector {
  /**
   * Obtém Read Models afetados por um Effect
   * 🔴 BLINDAGEM: ReadModel é projeção derivada, não fonte de verdade
   */
  getAffectedReadModels(effect: ActorEffect): ReadModelType[] {
    return EFFECT_READ_MODEL_MAP[effect] || [];
  }

  /**
   * Projeta Read Models a partir de um Effect
   * 🔴 BLINDAGEM: Chamado APENAS após effect ser emitido
   * Services NÃO atualizam read models manualmente
   * 
   * @param effect Effect que foi emitido
   * @param event Event completo do eventBus
   */
  async projectReadModels(
    effect: ActorEffect,
    event: UnificardEvent
  ): Promise<ReadModelProjectionResult[]> {
    const affectedReadModels = this.getAffectedReadModels(effect);
    
    if (affectedReadModels.length === 0) {
      return [];
    }

    const results: ReadModelProjectionResult[] = [];

    for (const readModelType of affectedReadModels) {
      try {
        // 🔴 BLINDAGEM: Projeção é assíncrona e pode falhar
        // Não quebra o fluxo principal se projeção falhar
        await this.projectReadModel(readModelType, event);
        
        results.push({
          success: true,
          readModelType,
          entityId: this.extractEntityId(event, readModelType),
        });
      } catch (error) {
        results.push({
          success: false,
          readModelType,
          entityId: this.extractEntityId(event, readModelType),
          errors: [{
            field: 'projection',
            error: error instanceof Error ? error.message : String(error),
          }],
        });
      }
    }

    return results;
  }

  /**
   * Projeta um Read Model específico
   * 🔴 BLINDAGEM: Implementação específica por tipo de Read Model
   * Pode ser sobrescrita por implementações específicas
   */
  protected async projectReadModel(
    readModelType: ReadModelType,
    event: UnificardEvent
  ): Promise<void> {
    // Implementação base: apenas marca read model como inválido
    // Implementações específicas devem sobrescrever este método
    
    // Para read models que são calculados on-demand (como Profile),
    // não precisamos fazer nada aqui - eles são reconstruídos quando consultados
    
    // Para read models que são cached (como Feed),
    // podemos invalidar cache aqui
    
    // Por enquanto, apenas log para auditoria
    console.log(`[ReadModelProjector] Effect ${event.type} afeta ${readModelType}`);
  }

  /**
   * Extrai ID da entidade do evento para o Read Model
   */
  protected extractEntityId(
    event: UnificardEvent,
    readModelType: ReadModelType
  ): string {
    const payload = event.payload as any;
    
    // Tentar extrair ID baseado no tipo de Read Model
    switch (readModelType) {
      case ReadModelType.PROFILE_READ_MODEL:
      case ReadModelType.EDUCATION_PROFILE_READ_MODEL:
      case ReadModelType.PROFESSIONAL_PROFILE_READ_MODEL:
      case ReadModelType.LEARNING_PROFILE_READ_MODEL:
        return payload.actorId || payload.userId || '';
      
      case ReadModelType.FEED_READ_MODEL:
      case ReadModelType.POST_READ_MODEL:
        return payload.sourceId || payload.postId || '';
      
      case ReadModelType.PROJECT_READ_MODEL:
      case ReadModelType.PROJECT_LIST_READ_MODEL:
        return payload.sourceId || payload.projectId || '';
      
      case ReadModelType.GROUP_READ_MODEL:
        return payload.groupId || '';
      
      case ReadModelType.REPUTATION_READ_MODEL:
        return payload.actorId || '';
      
      default:
        return payload.sourceId || payload.entityId || '';
    }
  }

  /**
   * Obtém mapa completo de Effect → Read Models
   */
  getEffectReadModelMap(): Record<ActorEffect, ReadModelType[]> {
    return EFFECT_READ_MODEL_MAP;
  }
}

export const readModelProjector = new ReadModelProjector();

/**
 * Registra handlers do EventBus para projeção de Read Models
 * 🔴 BLINDAGEM: Handlers consomem effects, não intents
 */
export async function registerReadModelHandlers(): Promise<void> {
  // Registrar handler para cada effect que afeta read models
  const { ActorEffect } = await import('@core/social/ports');
  
  Object.values(ActorEffect).forEach((effect: ActorEffect) => {
    const eventType = `actor.effect.${effect.toLowerCase()}`;
    
    eventBus.registerHandler(eventType, async (event: UnificardEvent) => {
      try {
        await readModelProjector.projectReadModels(effect, event);
      } catch (error) {
        // Não quebra fluxo principal se projeção falhar
        console.error(`[ReadModelProjector] Erro ao projetar read models para ${effect}:`, error);
      }
    });
  });
  
  console.log('[ReadModelProjector] Handlers de projeção de Read Models registrados');
}

