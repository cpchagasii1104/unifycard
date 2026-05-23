// src/modules/social/adapters/actor-repository.adapter.ts
/**
 * Adapter: Actor Repository
 * 
 * Implementa interface do core usando repository real do module.
 */

import type { ActorRepositoryPort } from '@core/social/ports';
import { actorRepository as realRepository } from '../actor.repository';

export class ActorRepositoryAdapter implements ActorRepositoryPort {
  async findById(tenantId: string, actorId: string) {
    return realRepository.findById(tenantId, actorId);
  }

  async findByUserId(tenantId: string, userId: string) {
    return realRepository.findByUserId(tenantId, userId);
  }

  async findByCompanyId(tenantId: string, companyId: string) {
    return realRepository.findByCompanyId(tenantId, companyId);
  }

  async findOrCreateUserActor(tenantId: string, userId: string) {
    return realRepository.findOrCreateUserActor(tenantId, userId);
  }

  async findOrCreatePageActor(
    tenantId: string,
    companyId: string,
    responsibleActorId: string
  ) {
    return realRepository.findOrCreatePageActor(
      tenantId,
      companyId,
      responsibleActorId
    );
  }

  async updateUserActorDisplayName(tenantId: string, userId: string, displayName: string) {
    return realRepository.updateUserActorDisplayName(tenantId, userId, displayName);
  }

  async update(
    tenantId: string,
    actorId: string,
    updates: {
      display_name?: string;
      avatar_url?: string;
      cover_url?: string;
      bio?: string;
      metadata?: any;
    }
  ) {
    return realRepository.update(tenantId, actorId, updates);
  }

  async findAvailableActors(tenantId: string, userId: string) {
    return realRepository.findAvailableActors(tenantId, userId);
  }
}

export const actorRepositoryAdapter = new ActorRepositoryAdapter();





