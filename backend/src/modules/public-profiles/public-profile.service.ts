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
   * Cria perfil público
   */
  async createProfile(
    tenantId: string,
    input: CreatePublicProfileInput,
    createdByUserId: string
  ): Promise<PublicProfile> {
    // Validar que actor existe
    const { actorRepository } = await import('@modules/social/actor.repository');
    const actor = await actorRepository.findById(tenantId, input.actorId);
    if (!actor) {
      throw new Error('Actor não encontrado');
    }

    const profile = await publicProfileRepository.createProfile(tenantId, input);

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'PUBLIC_PROFILE_CREATED',
      profileId: profile.id,
      actorId: input.actorId,
      profileType: input.profileType,
      createdByUserId,
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
    // Por padrão, listar apenas públicos se não especificado
    if (filters.visibility === undefined) {
      filters.visibility = 'PUBLIC';
    }

    return await publicProfileRepository.listProfiles(tenantId, filters);
  }

  /**
   * Muda visibilidade do perfil
   */
  async changeVisibility(
    tenantId: string,
    profileId: string,
    visibility: 'PUBLIC' | 'PRIVATE',
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

