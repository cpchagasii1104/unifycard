// src/api/feedPlugins.ts
// Client API para Feed Plugin System
// Integra frontend com backend Feed Plugin System

import { apiFetchJson } from './client';

/**
 * Tipo de item do feed renderizado pelo plugin
 */
export interface FeedItemDTO {
  id: string;
  type: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  metadata?: Record<string, any>;
  availableActions?: string[];
  createdAt: string;
  updatedAt?: string;
}

/**
 * Ações disponíveis no feed
 */
export enum FeedAction {
  VIEW = 'view',
  BOOK = 'book',
  JOIN = 'join',
  SHARE = 'share',
  CONTACT = 'contact',
  BUY = 'buy',
  VOTE = 'vote',
  FOLLOW = 'follow',
}

/**
 * Resultado de resolução de plugin
 */
export interface PluginResolutionResult {
  ok: boolean;
  data: {
    postId: string;
    resolved: boolean;
    pluginName: string | null;
    reason?: string;
  };
}

/**
 * Resultado de renderização de post
 */
export interface RenderPostResult {
  ok: boolean;
  data: FeedItemDTO;
}

/**
 * Resultado de ações disponíveis
 */
export interface PostActionsResult {
  ok: boolean;
  data: {
    postId: string;
    actions: string[];
    note?: string;
  };
}

/**
 * Resolve plugin para um post
 * 
 * @param postId ID do post
 * @param sourceType Tipo da entidade fonte (geralmente 'post')
 * @param intent Intent do post
 * @returns Resultado da resolução
 */
export async function resolvePlugin(
  postId: string,
  sourceType: string,
  intent: string
): Promise<PluginResolutionResult> {
  const queryParams = new URLSearchParams({
    sourceType,
    intent,
  });
  
  return apiFetchJson<PluginResolutionResult>(
    `/feed/plugin/posts/${postId}/resolve?${queryParams.toString()}`
  );
}

/**
 * Renderiza post usando plugin
 * 
 * @param postId ID do post
 * @param sourceType Tipo da entidade fonte (geralmente 'post')
 * @param intent Intent do post
 * @returns DTO renderizado pelo plugin
 */
export async function renderPost(
  postId: string,
  sourceType: string,
  intent: string
): Promise<FeedItemDTO> {
  const queryParams = new URLSearchParams({
    sourceType,
    intent,
  });
  
  const result = await apiFetchJson<RenderPostResult>(
    `/feed/plugin/posts/${postId}/render?${queryParams.toString()}`
  );
  
  if (!result.ok || !result.data) {
    throw new Error('Erro ao renderizar post via plugin');
  }
  
  return result.data;
}

/**
 * Obtém ações disponíveis para um post
 * 
 * @param postId ID do post
 * @param sourceType Tipo da entidade fonte (geralmente 'post')
 * @param intent Intent do post
 * @returns Lista de ações disponíveis
 */
export async function getPostActions(
  postId: string,
  sourceType: string,
  intent: string
): Promise<string[]> {
  const queryParams = new URLSearchParams({
    sourceType,
    intent,
  });
  
  const result = await apiFetchJson<PostActionsResult>(
    `/feed/plugin/posts/${postId}/actions?${queryParams.toString()}`
  );
  
  if (!result.ok || !result.data) {
    return [];
  }
  
  return result.data.actions || [];
}

/**
 * Renderiza múltiplos posts em batch
 * 
 * @param postIds IDs dos posts a renderizar
 * @returns Map de postId → { pluginId, dto, actions }
 */
export async function renderBatch(
  postIds: string[]
): Promise<Record<string, {
  pluginId: string | null;
  dto: FeedItemDTO | null;
  actions: string[];
}>> {
  const result = await apiFetchJson<{
    ok: boolean;
    data: Record<string, {
      pluginId: string | null;
      dto: FeedItemDTO | null;
      actions: string[];
    }>;
  }>(
    `/feed/plugin/render-batch`,
    {
      method: 'POST',
      body: JSON.stringify({ postIds }),
    }
  );
  
  if (!result.ok || !result.data) {
    throw new Error('Erro ao renderizar posts em batch');
  }
  
  return result.data;
}

