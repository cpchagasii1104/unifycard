// backend/src/modules/public-profiles/public-profile.types.ts
// SPRINT 79 (dormente) → materializado por F-DISCOVERY-PUBLIC-PROFILE-SLICE-A (2026-07-03,
// VISIBILIDADE_E_DESCOBERTA_DESENHO_CANONICO.md selado por Clayton).
//
// ALINHAMENTO AO SCHEMA (o schema é o SSOT — migration 20260530440000_public_profiles.sql):
//   · profile_type CHECK ('user','page','group','cultural_profile') — os valores TS antigos
//     (ARTIST/BAND/COMPANY/VENUE maiúsculos) NUNCA passariam no CHECK (módulo era natimorto);
//   · visibility CHECK ('public','private','followers_only') — TS antigo usava maiúsculo
//     (segunda violação de CHECK dormente). Código alinhado à tabela, nunca o contrário.
//
// PAPEL (desenho canônico): public_profiles é a VITRINE — a "plaquinha" pública do actor,
// publicada por ESCOLHA do dono. Fase 1: visibility 'public' (achável por todos, cross-tenant)
// ou 'private' ("só eu" — fora da vitrine). 'followers_only' existe no CHECK mas NÃO é oferecido
// na Fase 1 (Fase 2 depende de DT-SOCIAL-POST-VISIBILITY-NOT-ENFORCED-ON-READ fechada).
// Nenhuma ação financeira. Nenhuma autoridade concedida por visibilidade.

export type PublicProfileType = 'user' | 'page' | 'group' | 'cultural_profile';

export type PublicProfileVisibility = 'public' | 'private' | 'followers_only';

/** Visibilidades que a Fase 1 aceita no publish (subset consciente do CHECK). */
export type PublishVisibility = 'public' | 'private';

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
  createdAt: string;
  updatedAt: string;
}

export interface CreatePublicProfileInput {
  actorId: string;
  profileType: PublicProfileType;
  slug?: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  coverUrl?: string;
  visibility?: PublicProfileVisibility;
  metadata?: Record<string, any>;
}

export interface UpdatePublicProfileInput {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  coverUrl?: string;
  visibility?: PublicProfileVisibility;
  metadata?: Record<string, any>;
}

export interface PublicProfileFilters {
  profileType?: PublicProfileType;
  visibility?: PublicProfileVisibility;
  actorId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Hit da VITRINE global (leitura cross-tenant da busca).
 * PROJEÇÃO SEGURA APENAS — nunca user_id, global_user_id, external_id, kyc, metadata.
 */
export interface GlobalDiscoveryHit {
  actorId: string;
  tenantId: string;
  displayName: string;
  slug: string | null;
  avatarUrl: string | null;
  bio: string | null;
  profileType: PublicProfileType;
}

/**
 * Projeção pública de UM perfil da vitrine (destino do clique no hit global). SÓ a plaquinha —
 * NUNCA tenant_id (anti-leak de origem), NUNCA PII/dinheiro/agenda/documentos. Cross-tenant LEGAL
 * pelo mesmo desenho selado de `searchGlobalPublic` (public_profiles sem RLS, só visibility='public').
 */
export interface GlobalPublicProfileView {
  actorId: string;
  displayName: string;
  slug: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  profileType: PublicProfileType;
  headline: string | null;
  link: string | null;
}

/**
 * CARTÃO PÚBLICO — o usuário escolhe, campo a campo, o que aparece na sua página da vitrine
 * (respeito à privacidade). SÓ campos NÃO-sensíveis por construção: mostrar/ocultar foto e bio +
 * autodescrição (headline) e um link. NUNCA CPF/nascimento/dinheiro/agenda/documentos (esses jamais
 * entram na vitrine). O nome sempre aparece (é a identidade sendo descoberta). Vive em
 * `public_profiles.metadata.card`.
 */
export interface PublicCard {
  showAvatar: boolean;
  showBio: boolean;
  headline: string | null;
  link: string | null;
}
