// src/modules/social/actor-intents.service.ts
// Serviço de validação e resolução de INTENTS
// 🔴 BLINDAGEM: Intent ≠ Capacidade ≠ Permissão
// - Intent: o "por quê" da ação, o significado do evento
// - Capacidade: ação possível no sistema, associada ao tipo de Actor
// - Permissão: validação pontual baseada em estado (reputação, verificação, etc)
// - UI NÃO decide intent - intent é semântica explícita
// - Payload NÃO define semântica - intent define semântica

import {
  ActorIntent,
  LEGACY_INTENT_MAP,
  INTENT_TO_LEGACY_MAP,
  IntentValidationResult,
} from './actor-intents.types';
import { ActorCapability } from './actor-capabilities.types';
import { actorCapabilitiesService } from './actor-capabilities.service';
import { actorRepository } from './actor.repository';
import { runQueryWithTenant } from '@core/database/pool';
import { HttpError } from '@core/errors/http-error';
import type { PermissionKey } from '@core/authorization/permission-keys';

/**
 * Mapa explícito: INTENT → Capacidades exigidas
 * 🔴 BLINDAGEM: Nada implícito, nada mágico
 * Tudo explícito em código
 */
const INTENT_CAPABILITY_MAP: Record<ActorIntent, ActorCapability[]> = {
  [ActorIntent.SHARE_CONTENT]: [ActorCapability.POST_CONTENT],
  [ActorIntent.ANNOUNCE_EVENT]: [ActorCapability.POST_CONTENT, ActorCapability.CREATE_EVENT],
  [ActorIntent.OFFER_SERVICE]: [ActorCapability.POST_CONTENT],
  [ActorIntent.OFFER_PRODUCT]: [ActorCapability.POST_CONTENT],
  [ActorIntent.REQUEST_BOOKING]: [ActorCapability.POST_CONTENT],
  [ActorIntent.CREATE_PROJECT]: [ActorCapability.POST_CONTENT, ActorCapability.CREATE_PROJECT],
  [ActorIntent.ANNOUNCE_JOB]: [ActorCapability.POST_CONTENT, ActorCapability.CREATE_JOB],
  [ActorIntent.START_VOTE]: [ActorCapability.POST_CONTENT, ActorCapability.VOTE],
  [ActorIntent.REQUEST_HELP]: [ActorCapability.POST_CONTENT],
  [ActorIntent.SEND_CTA]: [ActorCapability.POST_CONTENT, ActorCapability.CREATE_CTA],
  [ActorIntent.RECEIVE_PAYMENT]: [ActorCapability.RECEIVE_FUNDS],
};

/**
 * Serviço de Intents
 */
class ActorIntentsService {
  /**
   * Converte intent legado (string) para ActorIntent (enum)
   * 🔴 BLINDAGEM: Mantido para compatibilidade
   */
  normalizeIntent(intent: string | ActorIntent | undefined): ActorIntent | null {
    if (!intent) {
      return null;
    }

    // Se já é enum, retornar
    if (Object.values(ActorIntent).includes(intent as ActorIntent)) {
      return intent as ActorIntent;
    }

    // Se é string legado, converter
    return LEGACY_INTENT_MAP[intent] || null;
  }

  /**
   * Converte ActorIntent (enum) para string legado
   * 🔴 BLINDAGEM: Mantido para compatibilidade com banco de dados
   */
  toLegacyIntent(intent: ActorIntent): string {
    return INTENT_TO_LEGACY_MAP[intent] || 'personal';
  }

  /**
   * Valida Intent para um Actor específico
   * 🔴 BLINDAGEM: Validação centralizada - nenhuma rota deve validar intent manualmente
   * 
   * Fluxo:
   * 1. Verifica se intent é válido
   * 2. Verifica capacidades exigidas
   * 3. Verifica permissões (se aplicável)
   * 4. Retorna resultado explícito
   */
  async validateIntent(
    tenantId: string,
    actorId: string,
    intent: string | ActorIntent | undefined,
    companyStatus?: string,
    userId?: string
  ): Promise<IntentValidationResult> {
    // 1. Normalizar intent
    const normalizedIntent = this.normalizeIntent(intent);
    if (!normalizedIntent) {
      return {
        valid: false,
        reason: `Invalid intent: ${intent}. Must be one of: ${Object.values(ActorIntent).join(', ')}`,
      };
    }

    // 2. Buscar actor
    const actor = await actorRepository.findById(tenantId, actorId);
    if (!actor) {
      return {
        valid: false,
        reason: `Actor not found: ${actorId}`,
      };
    }

    // 3. Verificar capacidades exigidas
    const requiredCapabilities = INTENT_CAPABILITY_MAP[normalizedIntent];
    if (!requiredCapabilities || requiredCapabilities.length === 0) {
      return {
        valid: false,
        reason: `Intent '${normalizedIntent}' does not have required capabilities defined`,
      };
    }

    // 4. Verificar cada capacidade exigida
    for (const capability of requiredCapabilities) {
      const capabilityCheck = await actorCapabilitiesService.hasCapability(
        tenantId,
        actorId,
        capability
      );

      if (!capabilityCheck.hasCapability) {
        return {
          valid: false,
          reason: capabilityCheck.reason || `Actor does not have required capability: ${capability}`,
          requiredCapability: capability,
        };
      }
    }

    // 5. Verificar permissões via authority.service (fachada modules — §4.9)
    if (userId && (normalizedIntent === ActorIntent.START_VOTE || 
        normalizedIntent === ActorIntent.CREATE_PROJECT ||
        normalizedIntent === ActorIntent.SEND_CTA)) {
      const { authorityService } = await import('@modules/authority/authority.service');
      
      let permissionKey: PermissionKey;
      if (normalizedIntent === ActorIntent.START_VOTE) {
        permissionKey = 'create_vote';
      } else if (normalizedIntent === ActorIntent.CREATE_PROJECT || normalizedIntent === ActorIntent.SEND_CTA) {
        // CREATE_PROJECT e SEND_CTA criam posts no feed, então usam publish_feed
        permissionKey = 'publish_feed';
      } else {
        // Fallback (não deve acontecer devido ao if acima)
        permissionKey = 'publish_feed';
      }

      const auth = await authorityService.canPerformAction(
        actorId,
        permissionKey,
        undefined,
        { tenantId, userId }
      );

      if (!auth.allowed) {
        let reason = auth.reason;
        if (!reason) {
          if (normalizedIntent === ActorIntent.START_VOTE) {
            reason = 'Você não tem permissão para criar votações. Continue usando a plataforma para desbloquear esta funcionalidade.';
          } else if (normalizedIntent === ActorIntent.CREATE_PROJECT) {
            reason = 'Você não tem permissão para criar projetos. Continue usando a plataforma para desbloquear esta funcionalidade.';
          } else if (normalizedIntent === ActorIntent.SEND_CTA) {
            reason = 'Você não tem permissão para criar CTAs. Continue usando a plataforma para desbloquear esta funcionalidade.';
          }
        }
        return {
          valid: false,
          reason,
          requiredCapability: normalizedIntent === ActorIntent.START_VOTE 
            ? ActorCapability.VOTE 
            : normalizedIntent === ActorIntent.CREATE_PROJECT 
              ? ActorCapability.CREATE_PROJECT 
              : ActorCapability.CREATE_CTA,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Obtém capacidades exigidas por um Intent
   */
  getRequiredCapabilities(intent: ActorIntent): ActorCapability[] {
    return INTENT_CAPABILITY_MAP[intent] || [];
  }

  /**
   * Obtém mapa completo de Intent → Capacidades
   */
  getIntentCapabilityMap(): Record<ActorIntent, ActorCapability[]> {
    return INTENT_CAPABILITY_MAP;
  }
}

export const actorIntentsService = new ActorIntentsService();

