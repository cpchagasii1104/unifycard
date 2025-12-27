// src/api/social-2.0.ts
// API client para Social 2.0

import { apiFetch } from './client';

export interface Actor {
  actor_id: string;
  actor_type: 'user' | 'page' | 'group' | 'channel';
  display_name: string;
  slug: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
}

export interface Post {
  post_id: string;
  actor_id: string | null;
  content: string;
  media: MediaItem[];
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
      gender?: ('male' | 'female' | 'other')[];
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
}

/**
 * Busca feed com cursor pagination
 */
export async function getFeed(cursor?: string, limit: number = 20): Promise<FeedResponse> {
  const params = new URLSearchParams();
  if (cursor) params.append('cursor', cursor);
  params.append('limit', limit.toString());

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
  reactionType: 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry'
): Promise<{ reaction_id: string; reaction_type: string; is_new: boolean }> {
  const response = await apiFetch(`/social/posts/${postId}/reactions`, {
    method: 'POST',
    body: JSON.stringify({ reaction_type: reactionType }),
  });
  return response.json();
}

/**
 * Adiciona comentário
 */
export async function createComment(
  postId: string,
  input: CommentInput
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
