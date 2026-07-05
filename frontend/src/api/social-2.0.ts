// src/api/social-2.0.ts
// API client para Social 2.0

import type { Gender } from '@unificard/contracts';
import { apiFetch } from './client';

export interface Actor {
  actor_id: string;
  actor_type: 'user' | 'page' | 'group' | 'channel';
  display_name: string;
  slug: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  // Extended fields for compatibility
  posts?: any[];
  counts?: {
    posts?: number;
    followers?: number;
    following?: number;
    posts_count?: number;
    followers_count?: number;
  };
  user_role?: string;
  company_status?: string;
  is_following?: boolean;
}

/** F-SOCIAL-POST-VISIBILITY-READ-ENFORCEMENT (Fatia 5) — plateia governada e OBEDECIDA na leitura. */
export type PostAudienceVisibility = 'public' | 'connections' | 'only_me';

export interface Post {
  post_id: string;
  actor_id: string | null;
  content: string;
  media: MediaItem[];
  visibility?: PostAudienceVisibility;
  intent?: 'personal' | 'friends' | 'booking' | 'service_offer' | 'product_offer' | 'project' | 'vote' | 'event';
  intent_metadata?: Record<string, any>;
  targeting?: Record<string, any>;
  created_at: string;
  actor: Actor | null;
  reactions_count: number;
  comments_count: number;
  user_reaction: string | null;
  relevance_score?: number;
  vote_results?: {
    options: Array<{ index: number; text: string; count: number; percentage: number }>;
    total_votes: number;
    closes_at?: string;
    is_closed?: boolean;
  };
  cta?: {
    cta_id: string;
    cta_type: 'booking' | 'service' | 'payment';
    target_actor_id: string | null;
    target_group_id: string | null;
    price: number | null;
    currency: string;
  };
  social_impact?: {
    group_name: string | null;
    total_impact_cents: number;
  };
  linked_event?: any;
}

export interface MediaItem {
  media_id: string;
  media_type: 'image' | 'video' | 'audio' | 'document';
  url: string;
  thumbnail_url?: string;
}

export interface FeedResponse {
  posts: Post[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface CreatePostInput {
  content: string;
  actor_id?: string;
  media_ids?: string[];
  intent?: 'personal' | 'friends' | 'booking' | 'service_offer' | 'product_offer' | 'project' | 'vote' | 'event';
  intent_metadata?: Record<string, any>;
  targeting?: {
    demographics?: {
      age_range?: [number, number];
      gender?: Gender[];
    };
    lifestyle?: {
      drinks?: boolean;
      smokes?: boolean;
    };
    mobility?: {
      has_car?: boolean;
      uses_bike?: boolean;
      uses_skate?: boolean;
    };
    interests?: string[];
    professions?: string[];
    locations?: {
      radius_km?: number;
      city_id?: string;
    };
  };
  cta?: {
    type: 'booking' | 'service' | 'payment';
    target_actor_id?: string;
    target_group_id?: string;
    price?: number;
    currency?: string;
    metadata?: Record<string, any>;
  };
  group_id?: string; // ID do grupo para vincular o post
  /** F-SOCIAL-POST-VISIBILITY-READ-ENFORCEMENT (Fatia 5). Ausente = 'public' (backend decide). */
  visibility?: PostAudienceVisibility;
}

export interface ReactionInput {
  reaction_type?: 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry';
}

export interface CommentInput {
  content: string;
  parent_comment_id?: string;
}

export interface Comment {
  comment_id: string;
  content: string;
  parent_comment_id: string | null;
  created_at: string;
  actor: Actor;
}

export interface ActorProfile {
  actor: Actor;
  posts: Post[];
  // Extended fields for compatibility
  counts?: {
    posts?: number;
    followers?: number;
    following?: number;
  };
  is_following?: boolean;
}

/**
 * Tipos do payload polimórfico de filtro geo (DECISION-0030 — F3).
 * Backend resolve via feed-proximity.service. Frontend apenas envia.
 */
export type FeedScope = 'radius_km' | 'city' | 'state' | 'unlimited';

export interface FeedProximityOptions {
  scope?: FeedScope;
  /** Obrigatório quando scope='radius_km'; em km */
  value?: number;
  /** Quando true, inclui posts sem address_id (globais) */
  include_global?: boolean;
}

/**
 * Busca feed com cursor pagination + filtro geo opcional (DECISION-0030).
 *
 * @param cursor Cursor para paginação
 * @param limit Limite de posts por página
 * @param groupId ID do grupo para filtrar posts (opcional)
 * @param actorType Tipo do ator (user | page) - obrigatório se não fornecido via activeActor
 * @param actorId ID do ator - obrigatório se não fornecido via activeActor
 *
 * Filtro geo via options object:
 *   getFeed({ scope: 'radius_km', value: 10, include_global: true, ... })
 *
 * Backward compat: ausência de scope = comportamento original (sem filtro geo).
 */
export async function getFeed(
  cursorOrOptions?: string | (Record<string, any> & FeedProximityOptions),
  limit: number = 20,
  groupId?: string,
  actorType?: 'user' | 'page',
  actorId?: string
): Promise<FeedResponse> {
  const params = new URLSearchParams();

  // Handle both old signature and new object-based signature
  if (typeof cursorOrOptions === 'object' && cursorOrOptions !== null) {
    const opts = cursorOrOptions;
    if (opts.cursor) params.append('cursor', opts.cursor);
    params.append('limit', (opts.limit || 20).toString());
    if (opts.group_id) params.append('group_id', opts.group_id);
    if (opts.actor_type) params.append('actor_type', opts.actor_type);
    if (opts.actor_id) params.append('actor_id', opts.actor_id);
    // DECISION-0030 (F3): filtro geo polimórfico
    if (opts.scope) {
      params.append('scope', opts.scope);
      if (opts.scope === 'radius_km' && typeof opts.value === 'number') {
        params.append('value', String(opts.value));
      }
      if (opts.include_global) {
        params.append('include_global', 'true');
      }
    }
  } else {
    if (cursorOrOptions) params.append('cursor', cursorOrOptions);
    params.append('limit', limit.toString());
    if (groupId) params.append('group_id', groupId);
    if (actorType) params.append('actor_type', actorType);
    if (actorId) params.append('actor_id', actorId);
  }

  const response = await apiFetch(`/social/feed?${params.toString()}`);
  return response.json();
}

/**
 * Cria um novo post
 */
export async function createPost(input: CreatePostInput): Promise<Post> {
  const response = await apiFetch('/social/posts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response.json();
}

/**
 * Adiciona ou atualiza reação
 */
export async function toggleReaction(
  postId: string,
  reactionType: 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry',
  _queryParams?: string
): Promise<{ reaction_id: string; reaction_type: string; is_new: boolean }> {
  const response = await apiFetch(`/social/posts/${postId}/reactions`, {
    method: 'POST',
    body: JSON.stringify({ reaction_type: reactionType }),
  });
  return response.json();
}

/**
 * Busca comentários de um post (paginado por cursor).
 * DT-PRESSURE-COMMENTS-FANTASMA (2026-05-18, fechada 2026-07-05): backend GET
 * /social/posts/:id/comments já existia e era real; só o client frontend estava em quarentena
 * (throw NOT_IMPLEMENTED) porque a auditoria original não tinha confirmado o endpoint.
 */
export async function getComments(
  postId: string,
  options?: { cursor?: string; limit?: number }
): Promise<{ comments: Comment[]; next_cursor: string | null; has_more: boolean }> {
  const params = new URLSearchParams();
  if (options?.cursor) params.set('cursor', options.cursor);
  if (options?.limit) params.set('limit', String(options.limit));
  const qs = params.toString();
  const response = await apiFetch(`/social/posts/${postId}/comments${qs ? `?${qs}` : ''}`);
  return response.json();
}

/**
 * Adiciona comentário
 */
export async function createComment(
  postId: string,
  input: CommentInput,
  _extra?: any
): Promise<Comment> {
  const response = await apiFetch(`/social/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response.json();
}

/**
 * Busca perfil/página do actor
 */
export async function getActorProfile(actorId: string): Promise<ActorProfile> {
  const response = await apiFetch(`/social/actors/${actorId}`);
  return response.json();
}

/**
 * Gera presign URL para upload de mídia
 */
export async function getPresignUrl(
  mediaType: 'image' | 'video' | 'audio' | 'document',
  fileName: string,
  fileSize: number,
  mimeType: string
): Promise<{ media_id: string; upload_url: string; expires_at: string }> {
  const response = await apiFetch('/media/presign', {
    method: 'POST',
    body: JSON.stringify({
      media_type: mediaType,
      file_name: fileName,
      file_size: fileSize,
      mime_type: mimeType,
    }),
  });
  return response.json();
}
