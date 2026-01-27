// src/core/social/ports/social-service.port.ts
/**
 * Port: Social Service
 * 
 * Interface para serviço social.
 * Implementação real está em @modules/social
 */

import type { FastifyInstance } from 'fastify';

export interface CreatePostInput {
  content: string;
  categories?: string[];
  intent?: string | null;
  metadata?: any;
  isServicePost?: boolean;
  serviceInfo?: {
    categoryId: string;
    categoryName: string;
    price: number;
  };
}

export interface Post {
  postId: string;
  tenantId: string;
  globalUserId: string;
  content: string;
  type: string | null;
  visibility: string | null;
  media: any;
  intent: string | null;
  confidence: number | null;
  categories: string[];
  suggestedActions: any;
  metadata: any;
  eventId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SocialServicePort {
  createPost(
    fastify: FastifyInstance,
    tenantId: string,
    globalUserId: string,
    input: CreatePostInput
  ): Promise<Post>;
}





