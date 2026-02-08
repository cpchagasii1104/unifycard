// backend/src/core/publication/publication-engine.types.ts
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
 * Tipos de ações auditáveis
 */
export type PublicationAction =
  | 'SET_VISIBILITY'
  | 'SET_DESTINATIONS'
  | 'ENABLE_INVITATIONS'
  | 'DISABLE_INVITATIONS'
  | 'SET_INVITATION_METHODS'
  | 'SEND_INVITES'
  | 'GENERATE_LINK'
  | 'REACTION'
  | 'VIEW'
  | 'CLICK'
  | 'SHARE';

/**
 * Tipos de reação
 */
export type ReactionType = 'like' | 'dislike' | 'love' | 'laugh' | 'angry' | 'sad';

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
  createdAt: string;
  updatedAt: string;
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
 * Input para gerar link compartilhável
 */
export interface GenerateLinkInput {
  entity_type: EntityType;
  entity_id: string;
  referral_code?: string | null;
  expiresAt?: string | null; // Opcional: link com expiração
}

/**
 * Resultado da geração de link
 */
export interface GeneratedLink {
  url: string;
  referral_code: string | null;
  expiresAt: string | null;
}

/**
 * Contexto para verificar visibilidade
 */
export interface VisibilityContext {
  user_id?: string;
  actor_id?: string;
  actor_type?: 'user' | 'page' | 'group' | 'channel';
  group_id?: string; // Para verificar se usuário está no grupo
  is_follower?: boolean; // Para visibilidade 'followers'
  is_friend?: boolean; // Para visibilidade 'friends'
}

/**
 * Payload de auditoria (flexível)
 */
export interface AuditPayload {
  [key: string]: any;
  // Exemplos:
  // old_visibility?: Visibility;
  // new_visibility?: Visibility;
  // destinations?: PublicationDestination[];
  // invitation_count?: number;
  // method?: InvitationMethod;
  // link?: string;
  // referral_code?: string;
  // reaction_type?: ReactionType;
}

/**
 * Input para log de auditoria
 */
export interface LogAuditInput {
  entity_type: EntityType;
  entity_id: string;
  action: PublicationAction;
  payload: AuditPayload;
  actor_id: string;
  actor_type: 'user' | 'page' | 'group' | 'channel';
}

/**
 * Input para criar reação
 */
export interface CreateReactionInput {
  entity_type: EntityType;
  entity_id: string;
  reaction_type: ReactionType;
  user_id: string;
  actor_id?: string; // Opcional: se reagiu como actor
}

/**
 * Contagem de reações
 */
export interface ReactionCount {
  reaction_type: ReactionType;
  count: number;
}

/**
 * Regras para determinar destinos baseado em visibilidade
 */
export interface DestinationRules {
  visibility: Visibility;
  entity_type: EntityType;
  actor_type: 'user' | 'page' | 'group' | 'channel';
}




