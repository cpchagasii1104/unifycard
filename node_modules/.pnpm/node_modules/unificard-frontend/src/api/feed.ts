// src/api/feed.ts
// API de Feed Contextual + Feed Unificado

import { FeedResponse } from '@unificard/contracts';
import { apiFetch } from './client';

export type FeedContentType = 
  | 'pleasure'
  | 'learning'
  | 'transition'
  | 'human';

export interface FeedContent {
  id: string;
  type: FeedContentType;
  title: string;
  description?: string;
  author?: {
    id: string;
    name: string;
    avatar?: string;
  };
  metadata?: {
    categoryId?: string;
    categoryName?: string;
    tags?: string[];
    estimatedReadTime?: number;
  };
  createdAt: string;
  priority: number;
}

export interface FeedSection {
  id: string;
  title: string;
  subtitle?: string;
  contentType: FeedContentType;
  contents: FeedContent[];
  priority: number;
}

export interface FeedContextual {
  userState: string;
  contextHeader?: string;
  sections: FeedSection[];
  hasMore: boolean;
}

export async function getContextualFeed(limit: number = 20): Promise<FeedContextual> {
  const response = await apiFetch(`/feed/contextual?limit=${limit}`);
  const result = await response.json();
  if (!result.ok) {
    throw new Error(result.message || 'Erro ao buscar feed contextual');
  }
  return result.data;
}

/**
 * Busca feed unificado (posts + eventos)
 */
export async function getUnifiedFeed(params?: {
  limit?: number;
  offset?: number;
  type?: string;
  cityId?: string;
}): Promise<FeedResponse> {
  const { limit = 50, offset = 0, type, cityId } = params || {};
  
  const queryParams = new URLSearchParams();
  if (limit) queryParams.append('limit', limit.toString());
  if (offset) queryParams.append('offset', offset.toString());
  if (type) queryParams.append('type', type);
  if (cityId) queryParams.append('cityId', cityId);
  
  const response = await apiFetch(`/api/feed?${queryParams.toString()}`);
  return response.json();
}

/**
 * Registra ação do usuário sobre um conteúdo do feed
 */
export async function recordContentAction(
  contentId: string,
  action: 'like' | 'dislike' | 'save' | 'ignore'
): Promise<void> {
  const response = await apiFetch('/feed/action', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ contentId, action }),
  });
  
  const result = await response.json();
  if (!result.ok) {
    throw new Error(result.message || 'Erro ao registrar ação');
  }
}

