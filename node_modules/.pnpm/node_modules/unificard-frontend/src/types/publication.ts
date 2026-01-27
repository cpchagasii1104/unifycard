// frontend/src/types/publication.ts
// Tipos para o Motor Canônico de Publicação, Visibilidade e Convites

/**
 * Tipos de entidades suportadas
 */
export type EntityType = 'event' | 'post' | 'group' | 'channel';

/**
 * Níveis de visibilidade (acesso)
 */
export type Visibility = 'public' | 'private' | 'unlisted' | 'followers' | 'group' | 'friends';

/**
 * Destinos de publicação (onde a entidade aparece)
 */
export type PublicationDestination = 'feed' | 'group_feed' | 'event_feed' | 'profile' | 'search' | 'none';

/**
 * Métodos de convite
 */
export type InvitationMethod = 'internal' | 'whatsapp' | 'email' | 'shareable_link' | 'external_with_signup';

/**
 * Metadados de publicação
 */
export interface PublicationMetadata {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  tenant_id: string;
  visibility: Visibility;
  publication_destinations: PublicationDestination[];
  invitations_enabled: boolean;
  invitation_methods: InvitationMethod[];
  referral_code: string | null;
  created_by_actor_id: string;
  created_by_actor_type: 'user' | 'page' | 'group' | 'channel';
  created_at: string;
  updated_at: string;
}

/**
 * Input para criar/atualizar metadados
 */
export interface UpsertPublicationMetadataInput {
  entity_type: EntityType;
  entity_id: string;
  visibility?: Visibility;
  publication_destinations?: PublicationDestination[];
  invitations_enabled?: boolean;
  invitation_methods?: InvitationMethod[];
  referral_code?: string | null;
}

/**
 * Link compartilhável gerado
 */
export interface GeneratedLink {
  url: string;
  referral_code: string | null;
  expires_at: string | null;
}

/**
 * Tipos de reação
 */
export type ReactionType = 'like' | 'dislike' | 'love' | 'laugh' | 'angry' | 'sad';

/**
 * Contagem de reações
 */
export interface ReactionCount {
  reaction_type: ReactionType;
  count: number;
}



