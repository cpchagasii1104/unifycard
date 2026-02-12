// src/core/social/ports-registry.ts
/**
 * Registry: Social Ports
 * 
 * Mantém referências para implementações injetadas.
 * Core usa este registry, não importa modules diretamente.
 * 
 * Ver: ARCHITECTURAL_SOURCE_OF_TRUTH.md
 */

import type {
  ActorRepositoryPort,
  ActorUtilsPort,
  SocialRepositoryPort,
  SocialServicePort,
  EventFeedHandlersPort,
} from './ports';

class SocialPortsRegistry {
  private actorRepository?: ActorRepositoryPort;
  private actorUtils?: ActorUtilsPort;
  private socialRepository?: SocialRepositoryPort;
  private socialService?: SocialServicePort;
  private eventFeedHandlers?: EventFeedHandlersPort;

  // Actor Repository
  setActorRepository(adapter: ActorRepositoryPort) {
    this.actorRepository = adapter;
  }

  getActorRepository(): ActorRepositoryPort {
    if (!this.actorRepository) {
      throw new Error(
        'ActorRepository não foi injetado. ' +
        'Configurar em bootstrap antes de usar.'
      );
    }
    return this.actorRepository;
  }

  // Actor Utils
  setActorUtils(adapter: ActorUtilsPort) {
    this.actorUtils = adapter;
  }

  getActorUtils(): ActorUtilsPort {
    if (!this.actorUtils) {
      throw new Error(
        'ActorUtils não foi injetado. ' +
        'Configurar em bootstrap antes de usar.'
      );
    }
    return this.actorUtils;
  }

  // Social Repository
  setSocialRepository(adapter: SocialRepositoryPort) {
    this.socialRepository = adapter;
  }

  getSocialRepository(): SocialRepositoryPort {
    if (!this.socialRepository) {
      throw new Error(
        'SocialRepository não foi injetado. ' +
        'Configurar em bootstrap antes de usar.'
      );
    }
    return this.socialRepository;
  }

  // Social Service
  setSocialService(adapter: SocialServicePort) {
    this.socialService = adapter;
  }

  getSocialService(): SocialServicePort {
    if (!this.socialService) {
      throw new Error(
        'SocialService não foi injetado. ' +
        'Configurar em bootstrap antes de usar.'
      );
    }
    return this.socialService;
  }

  // Event Feed Handlers
  setEventFeedHandlers(adapter: EventFeedHandlersPort) {
    this.eventFeedHandlers = adapter;
  }

  getEventFeedHandlers(): EventFeedHandlersPort {
    if (!this.eventFeedHandlers) {
      throw new Error(
        'EventFeedHandlers não foi injetado. ' +
        'Configurar em bootstrap antes de usar.'
      );
    }
    return this.eventFeedHandlers;
  }
}

export const socialPortsRegistry = new SocialPortsRegistry();





