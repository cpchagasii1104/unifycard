// src/modules/social/adapters/social-service.adapter.ts
/**
 * Adapter: Social Service
 * 
 * Implementa interface do core usando service real do module.
 */

import type { SocialServicePort, CreatePostInput, Post } from '@core/social/ports';
import { socialService as realService } from '../social.service';
import type { FastifyInstance } from 'fastify';

export class SocialServiceAdapter implements SocialServicePort {
  async createPost(
    fastify: FastifyInstance,
    tenantId: string,
    globalUserId: string,
    input: CreatePostInput
  ): Promise<Post> {
    const post = await realService.createPost(fastify, tenantId, globalUserId, input);
    // Converter Post do module para Post do port
    return {
      postId: post.postId,
      tenantId: post.tenantId,
      globalUserId: post.globalUserId,
      content: post.content,
      type: post.type,
      visibility: post.visibility,
      media: post.media,
      intent: post.intent,
      confidence: post.confidence,
      categories: post.categories,
      suggestedActions: post.suggestedActions,
      metadata: post.metadata,
      eventId: post.eventId,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }
}

export const socialServiceAdapter = new SocialServiceAdapter();





