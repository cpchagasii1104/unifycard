// src/modules/social/actor-effects.service.ts
// Serviço de emissão centralizada de EFFECTS
// 🔴 BLINDAGEM: Effect é consequência sistêmica, não decisão humana
// - Intent define ação
// - Effect define consequência
// - Service NÃO decide efeito - effect é definido pelo contrato
// - Nada implícito, nada "dentro do service" - tudo explícito

import {
  ActorEffect,
  ActorEffectPayload,
  EffectEmissionResult,
} from './actor-effects.types';
import { ActorIntent } from './actor-intents.types';
import { getClientWithTenant } from '@core/database/pool';
import {
  insertEventOutboxRow,
  outboxEventIdFromSeed,
} from '@core/events/event-outbox.repository';
import { actorRepository } from './actor.repository';

/**
 * Mapa explícito: INTENT → EFFECTS[]
 * 🔴 BLINDAGEM: Nada implícito, nada "dentro do service"
 * Tudo explícito em código
 */
const INTENT_EFFECTS_MAP: Record<ActorIntent, ActorEffect[]> = {
  [ActorIntent.SHARE_CONTENT]: [
    ActorEffect.FEED_ITEM_CREATED,
    ActorEffect.IMPACT_RECORDED,
  ],
  [ActorIntent.ANNOUNCE_EVENT]: [
    ActorEffect.FEED_ITEM_CREATED,
    ActorEffect.EVENT_ANNOUNCED,
    ActorEffect.IMPACT_RECORDED,
  ],
  [ActorIntent.OFFER_SERVICE]: [
    ActorEffect.FEED_ITEM_CREATED,
    ActorEffect.SERVICE_CREATED, // Serviço criado
    ActorEffect.IMPACT_RECORDED,
  ],
  [ActorIntent.OFFER_PRODUCT]: [
    ActorEffect.FEED_ITEM_CREATED,
    ActorEffect.IMPACT_RECORDED,
  ],
  [ActorIntent.REQUEST_BOOKING]: [
    ActorEffect.FEED_ITEM_CREATED,
    ActorEffect.IMPACT_RECORDED,
  ],
  [ActorIntent.CREATE_PROJECT]: [
    ActorEffect.FEED_ITEM_CREATED,
    ActorEffect.PROJECT_CREATED,
    ActorEffect.IMPACT_RECORDED,
  ],
  [ActorIntent.ANNOUNCE_JOB]: [
    ActorEffect.FEED_ITEM_CREATED,
    ActorEffect.JOB_POSTED,
    ActorEffect.IMPACT_RECORDED,
  ],
  [ActorIntent.START_VOTE]: [
    ActorEffect.FEED_ITEM_CREATED,
    ActorEffect.VOTE_REGISTERED,
    ActorEffect.IMPACT_RECORDED,
  ],
  [ActorIntent.REQUEST_HELP]: [
    ActorEffect.FEED_ITEM_CREATED,
    ActorEffect.IMPACT_RECORDED,
  ],
  [ActorIntent.SEND_CTA]: [
    ActorEffect.FEED_ITEM_CREATED,
    ActorEffect.CTA_PUBLISHED,
    ActorEffect.IMPACT_RECORDED,
  ],
  [ActorIntent.RECEIVE_PAYMENT]: [
    ActorEffect.PAYMENT_INITIATED,
    ActorEffect.IMPACT_RECORDED,
  ],
};

/**
 * Serviço de Effects
 */
class ActorEffectsService {
  /**
   * Obtém effects esperados para um Intent
   * 🔴 BLINDAGEM: Effects são definidos pelo contrato, não pelo service
   */
  getExpectedEffects(intent: ActorIntent): ActorEffect[] {
    return INTENT_EFFECTS_MAP[intent] || [];
  }

  /**
   * Emite effects para um Intent validado
   * 🔴 BLINDAGEM: Chamado APENAS após validateIntent
   * Services não emitem effects manualmente
   * 
   * @param tenantId ID do tenant
   * @param actorId ID do actor
   * @param intent Intent validado
   * @param payload Payload adicional para os effects
   */
  async emitEffects(
    tenantId: string,
    actorId: string,
    intent: ActorIntent | string,
    payload?: Partial<ActorEffectPayload>
  ): Promise<EffectEmissionResult> {
    // Normalizar intent
    const { actorIntentsService } = await import('./actor-intents.service');
    const normalizedIntent = actorIntentsService.normalizeIntent(intent);
    
    if (!normalizedIntent) {
      return {
        success: false,
        effectsEmitted: [],
        errors: [{ effect: ActorEffect.FEED_ITEM_CREATED, error: `Invalid intent: ${intent}` }],
      };
    }

    // Buscar actor
    const actor = await actorRepository.findById(tenantId, actorId);
    if (!actor) {
      return {
        success: false,
        effectsEmitted: [],
        errors: [{ effect: ActorEffect.FEED_ITEM_CREATED, error: `Actor not found: ${actorId}` }],
      };
    }

    // Obter effects esperados
    const expectedEffects = this.getExpectedEffects(normalizedIntent);
    if (expectedEffects.length === 0) {
      return {
        success: true,
        effectsEmitted: [],
      };
    }

    // Preparar payload base
    const basePayload: ActorEffectPayload = {
      actorId: actor.actor_id,
      actorType: actor.actor_type as 'user' | 'page' | 'group' | 'channel',
      intent: actorIntentsService.toLegacyIntent(normalizedIntent),
      ...payload,
    };

    // Emitir cada effect via eventBus
    const effectsEmitted: ActorEffect[] = [];
    const errors: Array<{ effect: ActorEffect; error: string }> = [];

    for (const effect of expectedEffects) {
      try {
        const eventType = `actor.effect.${effect.toLowerCase()}`;
        const sourcePart = basePayload.sourceId ?? '';
        const outboxClient = await getClientWithTenant(tenantId);
        try {
          await outboxClient.query('BEGIN');
          await insertEventOutboxRow(outboxClient, {
            tenantId,
            eventId: outboxEventIdFromSeed(
              `${eventType}:${tenantId}:${actor.actor_id}:${normalizedIntent}:${effect}:${sourcePart}`
            ),
            eventType,
            eventVersion: 1,
            payload: {
              effect,
              ...basePayload,
            },
            metadata: {
              actorId: actor.actor_id,
              actorType: actor.actor_type,
              intent: normalizedIntent,
            },
          });
          await outboxClient.query('COMMIT');
        } catch (inner) {
          await outboxClient.query('ROLLBACK');
          throw inner;
        } finally {
          outboxClient.release();
        }
        effectsEmitted.push(effect);
      } catch (error) {
        errors.push({
          effect,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      success: errors.length === 0,
      effectsEmitted,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Obtém mapa completo de Intent → Effects
   */
  getIntentEffectsMap(): Record<ActorIntent, ActorEffect[]> {
    return INTENT_EFFECTS_MAP;
  }
}

export const actorEffectsService = new ActorEffectsService();

