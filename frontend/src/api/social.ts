// src/api/social.ts
// API Social centralizada - todas as chamadas passam por aqui

import { apiFetch } from './client';

export interface SocialFeedParams {
  cursor?: string;
  limit?: number;
  actor_type?: 'user' | 'page';
  actor_id?: string;
  actor_status?: string; // Status da empresa (PROVISIONAL, VERIFIED, etc)
  user_preferences?: { // NOVO: Preferências do usuário
    music_genres?: string[];
    event_types?: string[];
  };
  user_location?: { // NOVO: Localização do usuário
    lat: number;
    lng: number;
  };
}

export interface SocialFeedResponse {
  posts: PostCardData[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface PostCardData {
  post_id: string;
  actor: {
    actor_id: string;
    actor_type: string;
    display_name: string;
    avatar_url: string | null;
    cover_url?: string | null;
  } | null;
  content: string;
  media: any[];
  intent?: 'personal' | 'friends' | 'booking' | 'service_offer' | 'product_offer' | 'project' | 'vote' | 'event';
  intent_metadata?: Record<string, any>;
  created_at: string;
  reactions_count: number;
  comments_count: number;
  user_reaction: string | null;
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
  linked_event?: {
    id: string;
    title: string;
    datetime_start: string;
    location_cultural_profile_id: string | null;
    shared_by: string;
  };
}

export interface CreatePostPayload {
  content: string;
  actor_id?: string; // Actor que está criando o post (pessoal ou empresa)
  media_ids?: string[];
  intent?: 'personal' | 'friends' | 'booking' | 'service_offer' | 'product_offer' | 'project' | 'vote' | 'event';
  intent_metadata?: Record<string, any>;
  targeting?: Record<string, any>;
  cta?: {
    type: 'booking' | 'service' | 'payment';
    target_actor_id?: string;
    target_group_id?: string;
    price?: number;
    currency?: string;
  };
}

export interface Comment {
  comment_id: string;
  actor: {
    actor_id: string;
    display_name: string;
    avatar_url: string | null;
  };
  content: string;
  created_at: string;
  parent_comment_id: string | null;
}

export interface CommentsResponse {
  comments: Comment[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface CreateCommentPayload {
  content: string;
  parent_comment_id?: string;
}

export interface Actor {
  actor_id: string;
  actor_type: string;
  display_name: string;
  avatar_url: string | null;
  cover_url?: string | null;
  bio?: string | null;
}

export interface ActorResponse {
  actor: Actor;
  posts: PostCardData[];
  counts: {
    followers_count: number;
    posts_count: number;
  };
  is_following: boolean;
}

/**
 * Busca feed social com cursor pagination
 * 🔴 CRÍTICO: actor_type e actor_id são OBRIGATÓRIOS (backend Social 2.0 exige)
 */
export async function getSocialFeed(params: SocialFeedParams = {}): Promise<SocialFeedResponse> {
  const { cursor, limit = 20, actor_type, actor_id, actor_status, user_preferences, user_location } = params;
  
  // Validação: actor_type e actor_id são obrigatórios
  if (!actor_type || !actor_id) {
    const error = new Error('actor_type e actor_id são obrigatórios para buscar o feed');
    console.error('[getSocialFeed]', error.message);
    throw error;
  }
  
  const queryParams = new URLSearchParams();
  if (cursor) queryParams.append('cursor', cursor);
  queryParams.append('limit', limit.toString());
  queryParams.append('actor_type', actor_type);
  queryParams.append('actor_id', actor_id);
  if (actor_status) queryParams.append('actor_status', actor_status);
  // EVENTOS ÂNCORA: Preferências e geolocalização (opcionais)
  if (user_preferences) {
    queryParams.append('user_preferences', JSON.stringify(user_preferences));
  }
  if (user_location) {
    queryParams.append('user_location', JSON.stringify(user_location));
  }

  const response = await apiFetch(`/social/feed?${queryParams.toString()}`);
  return response.json();
}

/**
 * Cria um novo post
 */
export async function createSocialPost(payload: CreatePostPayload): Promise<PostCardData> {
  const response = await apiFetch('/social/posts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.json();
}

/**
 * Adiciona ou remove reação
 */
export async function toggleReaction(
  postId: string,
  reaction_type: 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry',
  queryParams?: string
): Promise<{ reaction_id: string; reaction_type: string; is_new: boolean }> {
  const url = queryParams 
    ? `/social/posts/${postId}/reactions?${queryParams}`
    : `/social/posts/${postId}/reactions`;
  const response = await apiFetch(url, {
    method: 'POST',
    body: JSON.stringify({ reaction_type }),
  });
  return response.json();
}

/**
 * Cria um comentário
 */
export async function createComment(
  postId: string,
  payload: CreateCommentPayload
): Promise<Comment> {
  const response = await apiFetch(`/social/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.json();
}

/**
 * Busca comentários de um post (NOVO)
 */
export async function getComments(
  postId: string,
  params: { cursor?: string; limit?: number } = {}
): Promise<CommentsResponse> {
  const { cursor, limit = 20 } = params;
  const queryParams = new URLSearchParams();
  if (cursor) queryParams.append('cursor', cursor);
  queryParams.append('limit', limit.toString());

  const response = await apiFetch(`/social/posts/${postId}/comments?${queryParams.toString()}`);
  return response.json();
}

/**
 * Registra voto em uma votação
 */
export async function vote(postId: string, option_index: number): Promise<{ ok: boolean; data?: any }> {
  const response = await apiFetch(`/social/posts/${postId}/vote`, {
    method: 'POST',
    body: JSON.stringify({ option_index }),
  });
  return response.json();
}

/**
 * Confirma CTA e registra transação
 */
export interface ConfirmCTAResponse {
  success: boolean;
  message: string;
  revenue_entry?: {
    ledger_id: string;
    amount_cents: number;
    currency: string;
    recipient_actor_id?: string | null;
  };
  profit_share_entry?: {
    ledger_id: string;
    amount_cents: number;
    currency: string;
    recipient_group_id?: string | null;
  };
}

export async function confirmCTA(
  cta_id: string,
  payload: { notes?: string } = {}
): Promise<ConfirmCTAResponse> {
  const response = await apiFetch(`/social/cta/${cta_id}/confirm`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.json();
}

/**
 * Busca ledger do usuário
 */
export async function getLedger(params: { limit?: number } = {}): Promise<{ entries: any[] }> {
  const { limit = 50 } = params;
  const response = await apiFetch(`/social/ledger?limit=${limit}`);
  return response.json();
}

/**
 * Busca resumo do ledger
 */
export async function getLedgerSummary(): Promise<{
  total_revenue_cents: number;
  total_profit_share_received_cents: number;
  total_donations_given_cents: number;
  total_commissions_cents: number;
  group_contributions: Array<{
    group_id: string;
    group_name: string;
    total_contributed_cents: number;
  }>;
}> {
  const response = await apiFetch('/social/ledger/summary');
  return response.json();
}

/**
 * Lista actors disponíveis para o usuário (pessoal + empresas com permissão)
 */
export interface AvailableActor {
  actor_id: string;
  actor_type: 'user' | 'page' | 'group' | 'channel';
  display_name: string;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  user_role?: string;
  can_post?: boolean;
  company_status?: 'DRAFT' | 'PROVISIONAL' | 'VERIFIED' | 'APPROVED' | 'SUSPENDED';
}

export interface GetAvailableActorsOptions {
  silent401?: boolean;
}

export async function getAvailableActors(options?: GetAvailableActorsOptions): Promise<AvailableActor[]> {
  try {
    const response = await apiFetch('/social/actors/available', {}, { silent401: options?.silent401 });
    const data = await response.json();
    return data.actors || [];
  } catch (error: any) {
    // Se for erro SILENT_401, retornar array vazio silenciosamente
    if (error?.code === 'SILENT_401' || error?.message === 'SILENT_401') {
      return [];
    }
    
    // Se for erro de backend offline, não logar como erro crítico
    if (error?.code === 'BACKEND_OFFLINE' || error?.isRetryable) {
      // Retornar array vazio silenciosamente - o sistema tentará reconectar
      return [];
    }
    
    // Outros erros: logar mas não quebrar
    console.warn('Erro ao buscar atores disponíveis:', error);
    return [];
  }
}

/**
 * Busca perfil/página do actor
 */
export async function getActor(actorId: string): Promise<ActorResponse> {
  const response = await apiFetch(`/social/actors/${actorId}`);
  return response.json();
}

/**
 * Segue um actor
 */
export async function followActor(actorId: string): Promise<{ success: boolean; is_following: boolean }> {
  const response = await apiFetch(`/social/actors/${actorId}/follow`, {
    method: 'POST',
  });
  return response.json();
}

/**
 * Deixa de seguir um actor
 */
export async function unfollowActor(actorId: string): Promise<{ success: boolean; is_following: boolean }> {
  const response = await apiFetch(`/social/actors/${actorId}/unfollow`, {
    method: 'POST',
  });
  return response.json();
}
