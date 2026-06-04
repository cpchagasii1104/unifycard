// src/modules/social/actor-capabilities.service.ts
// Serviço de resolução de capacidades por Actor
// 🔴 BLINDAGEM: Capacidade ≠ Permissão
// - Capacidade: ação possível no sistema, associada ao tipo de Actor
// - Permissão: validação pontual baseada em estado (reputação, verificação, etc)
// - UI NÃO decide capacidades - são definidas no backend
// - Isso protege o sistema no longo prazo contra decisões implícitas

import {
  ActorCapability,
  ActorType,
  ActorCapabilitiesMap,
  CapabilityCheck,
} from './actor-capabilities.types';
import { actorRepository, type ActorRow } from './actor.repository';
import { runQueryWithTenant } from '@core/database/pool';

/**
 * Mapa explícito de capacidades por tipo de Actor
 * 🔴 BLINDAGEM: Nada implícito, nada herdado silenciosamente
 * Tudo explícito em código
 */
const ACTOR_CAPABILITIES_MAP: ActorCapabilitiesMap = {
  // Pessoa Física (user)
  user: [
    ActorCapability.POST_CONTENT,
    ActorCapability.COMMENT,
    ActorCapability.VOTE,
    ActorCapability.APPLY_JOB,
    ActorCapability.SEND_FUNDS,
    ActorCapability.CREATE_EVENT,
    ActorCapability.CREATE_PROJECT, // PF pode criar projetos pessoais
    ActorCapability.CREATE_CTA,
  ],

  // Pessoa Jurídica (page)
  page: [
    ActorCapability.POST_CONTENT, // Condicional: enforcement exige kyb_status='approved' (DECISION-0094), NÃO company_status
    ActorCapability.COMMENT,
    ActorCapability.VOTE, // Condicional: enforcement exige kyb_status='approved' (DECISION-0094), NÃO company_status
    ActorCapability.CREATE_JOB,
    ActorCapability.CREATE_PROJECT,
    ActorCapability.RECEIVE_FUNDS,
    ActorCapability.SEND_FUNDS,
    ActorCapability.CREATE_EVENT,
    ActorCapability.HOST_EVENT,
    ActorCapability.CREATE_CTA,
    ActorCapability.MANAGE_MEMBERS, // Gerenciar funcionários
  ],

  // Grupo/Comunidade (group)
  group: [
    ActorCapability.POST_CONTENT,
    ActorCapability.COMMENT,
    ActorCapability.VOTE,
    ActorCapability.CREATE_PROJECT,
    ActorCapability.RECEIVE_FUNDS,
    ActorCapability.SEND_FUNDS,
    ActorCapability.MANAGE_MEMBERS, // Gerenciar membros do grupo
    ActorCapability.CREATE_EVENT,
  ],

  // Canal (channel) - Futuro
  channel: [
    // 🔴 BLINDAGEM: Channel não está habilitado ainda
    // Capacidades vazias explicitamente para evitar uso acidental
  ],
};

/**
 * Serviço de capacidades de Actor
 */
class ActorCapabilitiesService {
  /**
   * Resolve capacidades de um Actor específico
   * 🔴 BLINDAGEM: Capacidades são baseadas no tipo de Actor, não em estado
   * Estado (verificação, reputação) é validado em permissões, não em capacidades
   */
  async getActorCapabilities(
    tenantId: string,
    actorId: string
  ): Promise<ActorCapability[]> {
    const actor = await actorRepository.findById(tenantId, actorId);
    
    if (!actor) {
      return [];
    }

    // Retornar capacidades baseadas no tipo de Actor
    return ACTOR_CAPABILITIES_MAP[actor.actor_type as ActorType] || [];
  }

  /**
   * Verifica se um Actor tem uma capacidade específica
   * 🔴 BLINDAGEM: Verifica apenas capacidade (tipo de Actor)
   * Não valida permissão (estado) - isso é feito separadamente
   */
  async hasCapability(
    tenantId: string,
    actorId: string,
    capability: ActorCapability
  ): Promise<CapabilityCheck> {
    const capabilities = await this.getActorCapabilities(tenantId, actorId);
    const hasCapability = capabilities.includes(capability);

    if (!hasCapability) {
      const actor = await actorRepository.findById(tenantId, actorId);
      const actorType = actor?.actor_type || 'unknown';
      
      return {
        hasCapability: false,
        reason: `Actor type '${actorType}' does not have capability '${capability}'`,
      };
    }

    return { hasCapability: true };
  }

  /**
   * Obtém mapa completo de capacidades por tipo
   * Útil para documentação e validação
   */
  getCapabilitiesMap(): ActorCapabilitiesMap {
    return ACTOR_CAPABILITIES_MAP;
  }

  /**
   * Obtém capacidades por tipo de Actor (sem precisar buscar actor)
   */
  getCapabilitiesByType(actorType: ActorType): ActorCapability[] {
    return ACTOR_CAPABILITIES_MAP[actorType] || [];
  }
}

export const actorCapabilitiesService = new ActorCapabilitiesService();

