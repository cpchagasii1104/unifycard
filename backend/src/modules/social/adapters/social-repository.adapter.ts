// src/modules/social/adapters/social-repository.adapter.ts
/**
 * Adapter: Social Repository
 * 
 * Implementa interface do core usando repository real do module.
 */

import type { SocialRepositoryPort } from '@core/social/ports';
import { SocialRepository } from '../social.repository';

const realRepository = new SocialRepository();

export class SocialRepositoryAdapter implements SocialRepositoryPort {
  async findById(tenantId: string, postId: string) {
    return realRepository.findById(tenantId, postId);
  }

  async create(data: {
    tenantId: string;
    globalUserId: string;
    content: string;
    type?: string | null;
    visibility?: string | null;
    media: any;
    intent: string | null;
    confidence: number | null;
    categories: string[];
    suggestedActions: any;
    metadata: any;
    eventId?: string | null;
    createdByUserId?: string;
    createdAsActorId?: string;
  }) {
    return realRepository.create(data);
  }

  async findFeed(
    tenantId: string,
    options: {
      limit?: number;
      offset?: number;
      categoryId?: string;
      intent?: string;
      userId?: string;
    }
  ) {
    const result = await realRepository.findFeed(tenantId, options);
    return {
      posts: result.rows,
      total: result.total,
      hasMore: (options.offset || 0) + result.rows.length < result.total,
    };
  }
}

export const socialRepositoryAdapter = new SocialRepositoryAdapter();





