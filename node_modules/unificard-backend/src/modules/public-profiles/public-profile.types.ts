// backend/src/modules/public-profiles/public-profile.types.ts
// SPRINT 79: PÁGINAS PÚBLICAS (ARTISTAS, EMPRESAS, EVENTOS)

/**
 * Tipo de perfil público
 */
export type PublicProfileType = 'ARTIST' | 'BAND' | 'COMPANY' | 'VENUE';

/**
 * Visibilidade do perfil público
 */
export type PublicProfileVisibility = 'PUBLIC' | 'PRIVATE';

/**
 * Perfil público
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Perfil público ≠ Usuário
 * - Perfil público ≠ Empresa
 * - Um actor pode ter vários perfis
 * - Slug único por tenant
 * - Perfil PUBLIC aparece: Feed, Eventos, Marketplace
 * - Perfil PRIVATE não aparece publicamente
 */
export interface PublicProfile {
  id: string;
  tenantId: string;
  actorId: string;
  profileType: PublicProfileType;
  slug: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  visibility: PublicProfileVisibility;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input para criar perfil público
 */
export interface CreatePublicProfileInput {
  actorId: string;
  profileType: PublicProfileType;
  slug?: string; // Opcional, será gerado se não fornecido
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  coverUrl?: string;
  visibility?: PublicProfileVisibility;
  metadata?: Record<string, any>;
}

/**
 * Input para atualizar perfil público
 */
export interface UpdatePublicProfileInput {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  coverUrl?: string;
  visibility?: PublicProfileVisibility;
  metadata?: Record<string, any>;
}

/**
 * Filtros para listar perfis públicos
 */
export interface PublicProfileFilters {
  profileType?: PublicProfileType;
  visibility?: PublicProfileVisibility;
  actorId?: string;
  limit?: number;
  offset?: number;
}





