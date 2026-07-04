// backend/src/modules/public-profiles/public-profile.service.ts
// SPRINT 79: Service para Public Profiles

import { publicProfileRepository } from './public-profile.repository';
import type {
  PublicProfile,
  CreatePublicProfileInput,
  UpdatePublicProfileInput,
  PublicProfileFilters,
} from './public-profile.types';

/**
 * Service para Public Profiles
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Perfil público ≠ Usuário
 * - Perfil público ≠ Empresa
 * - Um actor pode ter vários perfis
 * - Slug único por tenant
 * - Perfil PUBLIC aparece: Feed, Eventos, Marketplace
 * - Perfil PRIVATE não aparece publicamente
 * - Nenhuma ação financeira
 * - Nenhuma automação
 * - Apenas representação pública
 */
class PublicProfileService {
  /**
   * Cria perfil público.
   *
   * 🔴 V2 CONFUSED-DEPUTY FIX (auditoria forense 2026-07-04): o SUJEITO do perfil (actorId)
   * é SEMPRE `authorizedActorId` — o actor cuja representação foi PROVADA na rota via
   * canRepresentActor (DECISION-0113) — NUNCA `input.actorId` (client-controlled). Antes, a rota
   * provava autoridade sobre actionContext.actorId mas o service escrevia sob req.body.actorId:
   * um atacante representando o próprio actor criava a vitrine sob o actor de uma VÍTIMA
   * (impersonação, amplificada cross-tenant pela leitura da vitrine). Defense-in-depth: o override
   * mora no SERVICE, não só na rota — qualquer caller herda a contenção.
   */
  async createProfile(
    tenantId: string,
    input: CreatePublicProfileInput,
    authorizedActorId: string
  ): Promise<PublicProfile> {
    // Validar que o actor PROVADO existe (não o do body)
    const { actorRepository } = await import('@modules/social/actor.repository');
    const actor = await actorRepository.findById(tenantId, authorizedActorId);
    if (!actor) {
      throw new Error('Actor não encontrado');
    }

    // O sujeito é o actor provado — input.actorId é DESCARTADO para a escrita.
    const safeInput: CreatePublicProfileInput = { ...input, actorId: authorizedActorId };
    const profile = await publicProfileRepository.createProfile(tenantId, safeInput);

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'PUBLIC_PROFILE_CREATED',
      profileId: profile.id,
      actorId: authorizedActorId,
      profileType: safeInput.profileType,
      createdByUserId: authorizedActorId,
    });

    return profile;
  }

  /**
   * Atualiza perfil público
   */
  async updateProfile(
    tenantId: string,
    profileId: string,
    input: UpdatePublicProfileInput,
    updatedByUserId: string
  ): Promise<PublicProfile> {
    // Verificar se perfil existe e pertence ao tenant
    const existing = await publicProfileRepository.getProfileById(tenantId, profileId);
    if (!existing) {
      throw new Error('Perfil público não encontrado');
    }

    const profile = await publicProfileRepository.updateProfile(tenantId, profileId, input);

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'PUBLIC_PROFILE_UPDATED',
      profileId: profile.id,
      updatedByUserId,
    });

    return profile;
  }

  /**
   * Busca perfil por slug
   */
  async getBySlug(tenantId: string, slug: string): Promise<PublicProfile | null> {
    return await publicProfileRepository.getProfileBySlug(tenantId, slug);
  }

  /**
   * Busca perfil por ID
   */
  async getById(tenantId: string, profileId: string): Promise<PublicProfile | null> {
    return await publicProfileRepository.getProfileById(tenantId, profileId);
  }

  /**
   * Lista perfis públicos
   */
  async listPublicProfiles(
    tenantId: string,
    filters: PublicProfileFilters = {}
  ): Promise<PublicProfile[]> {
    // Por padrão, listar apenas públicos se não especificado (minúsculo = CHECK da tabela)
    if (filters.visibility === undefined) {
      filters.visibility = 'public';
    }

    return await publicProfileRepository.listProfiles(tenantId, filters);
  }

  /**
   * Muda visibilidade do perfil
   */
  async changeVisibility(
    tenantId: string,
    profileId: string,
    visibility: 'public' | 'private',
    changedByUserId: string
  ): Promise<PublicProfile> {
    // Buscar perfil atual para pegar visibilidade antiga
    const existing = await publicProfileRepository.getProfileById(tenantId, profileId);
    if (!existing) {
      throw new Error('Perfil público não encontrado');
    }

    const oldVisibility = existing.visibility;

    const profile = await publicProfileRepository.updateProfile(
      tenantId,
      profileId,
      { visibility }
    );

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'PUBLIC_PROFILE_VISIBILITY_CHANGED',
      profileId: profile.id,
      oldVisibility,
      newVisibility: visibility,
      changedByUserId,
    });

    return profile;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // F-DISCOVERY-PUBLIC-PROFILE-SLICE-A (VISIBILIDADE_E_DESCOBERTA_DESENHO_CANONICO.md)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Publica (ou despublica) a plaquinha do actor na vitrine.
   * A AUTORIDADE (canRepresentActor) é provada NA ROTA antes de chegar aqui — este método
   * assume actorId já autorizado. A plaquinha é PROJEÇÃO do actor (display_name/bio/avatar
   * copiados na hora do publish) — nunca inventa dado novo, nunca expõe PII.
   * Fase 1: visibility 'public' (vitrine) ou 'private' ("só eu"). 'followers_only' = Fase 2.
   */
  async publishForActor(
    tenantId: string,
    actorId: string,
    visibility: 'public' | 'private',
    publishedByUserId: string
  ): Promise<import('./public-profile.types').PublicProfile> {
    const proj = await publicProfileRepository.getActorProjection(tenantId, actorId);
    if (!proj) {
      const err: any = new Error('Actor não encontrado');
      err.statusCode = 404;
      throw err;
    }
    // Vocabulário canônico DECISION-0157: só 'user' (Pessoas) e 'page' (Empresas) na vitrine.
    if (proj.actor_type !== 'user' && proj.actor_type !== 'page') {
      const err: any = new Error(`actor_type '${proj.actor_type}' não publicável na vitrine (Fase 1: user/page)`);
      err.statusCode = 422;
      throw err;
    }

    const profile = await publicProfileRepository.upsertByActor(tenantId, {
      actorId,
      profileType: proj.actor_type,
      displayName: proj.display_name,
      bio: proj.bio,
      avatarUrl: proj.avatar_url,
      visibility,
    });

    await this.recordAudit(tenantId, {
      eventType: 'PUBLIC_PROFILE_PUBLISHED',
      profileId: profile.id,
      actorId,
      newVisibility: visibility,
      changedByUserId: publishedByUserId,
    });

    return profile;
  }

  /** Plaquinha do próprio actor (ou null se nunca publicou). */
  async getMineByActor(tenantId: string, actorId: string): Promise<import('./public-profile.types').PublicProfile | null> {
    const rows = await publicProfileRepository.listProfiles(tenantId, { actorId, limit: 1 });
    return rows[0] ?? null;
  }

  /**
   * Leitura da vitrine — perfil público único (destino do clique no hit global). Cross-tenant por
   * design (só plaquinha pública opt-in); null se o actor não publicou público.
   */
  async getGlobalPublicProfile(actorId: string): Promise<import('./public-profile.types').GlobalPublicProfileView | null> {
    return await publicProfileRepository.getGlobalPublicProfileByActor(actorId);
  }

  /**
   * Lista perfis por actor
   */
  async listProfilesByActor(
    tenantId: string,
    actorId: string
  ): Promise<PublicProfile[]> {
    return await publicProfileRepository.listProfiles(tenantId, {
      actorId,
    });
  }

  private async recordAudit(
    tenantId: string,
    data: {
      eventType: string;
      profileId: string;
      actorId?: string;
      profileType?: string;
      createdByUserId?: string;
      updatedByUserId?: string;
      changedByUserId?: string;
      oldVisibility?: string;
      newVisibility?: string;
    }
  ): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, {
        event_type: data.eventType,
        severity: 'low',
        actor_id: (data.createdByUserId || data.updatedByUserId || data.changedByUserId) ?? undefined,
        actor_type: 'user',
        source: 'public_profiles',
        context: {
          profile_id: data.profileId,
          actor_id: data.actorId,
          profile_type: data.profileType,
          created_by_user_id: data.createdByUserId,
          updated_by_user_id: data.updatedByUserId,
          changed_by_user_id: data.changedByUserId,
          old_visibility: data.oldVisibility,
          new_visibility: data.newVisibility,
        },
      });
    } catch (error) {
      console.warn('[PublicProfile] Erro ao registrar auditoria:', error);
    }
  }
}

export const publicProfileService = new PublicProfileService();

