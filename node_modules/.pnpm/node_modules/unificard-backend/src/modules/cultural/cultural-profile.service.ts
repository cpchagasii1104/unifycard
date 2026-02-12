// src/modules/cultural/cultural-profile.service.ts
// Serviço para Perfis de Atuação Cultural (PAC) - FASE 16
// REGRA: PAC não é novo usuário, é perfil de atuação especializado

import { randomUUID } from 'crypto';
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';

export type CulturalProfileType =
  | 'ARTIST'
  | 'BAND'
  | 'BAR'
  | 'VENUE'
  | 'COLLECTIVE'
  | 'PRODUCER'
  | 'CIRCLE'
  | 'EDUCATOR'
  | 'CURATOR';

export type ActorType = 'user' | 'page';

export interface CulturalProfile {
  id: string;
  tenant_id: string;
  owner_actor_id: string;
  owner_actor_type: ActorType;
  type: CulturalProfileType;
  display_name: string;
  slug: string;
  description: string | null;
  linked_company_id: string | null;
  location: {
    city?: string;
    state?: string;
    address?: string;
    lat?: number;
    lng?: number;
  } | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCulturalProfileInput {
  owner_actor_id?: string;
  owner_actor_type?: ActorType;
  type?: CulturalProfileType;
  display_name?: string;
  slug?: string;
  description?: string;
  linked_company_id?: string;
  location?: {
    city?: string;
    state?: string;
    address?: string;
    lat?: number;
    lng?: number;
  };
}

export interface CulturalCapabilities {
  can_publish_events: boolean;
  can_host_events: boolean;
  can_define_revenue_split: boolean;
  can_sell_tickets: boolean;
  requires_location: boolean;
  requires_company: boolean;
}

class CulturalProfileService {
  /**
   * Mapeia capacidades por tipo cultural
   */
  getCapabilitiesByType(type: CulturalProfileType): CulturalCapabilities {
    const capabilities: Record<CulturalProfileType, CulturalCapabilities> = {
      ARTIST: {
        can_publish_events: true,
        can_host_events: false,
        can_define_revenue_split: true,
        can_sell_tickets: true, // Requer PJ VERIFIED
        requires_location: false,
        requires_company: false,
      },
      BAND: {
        can_publish_events: true,
        can_host_events: false,
        can_define_revenue_split: true,
        can_sell_tickets: true, // Requer PJ VERIFIED
        requires_location: false,
        requires_company: false,
      },
      BAR: {
        can_publish_events: true,
        can_host_events: true,
        can_define_revenue_split: true,
        can_sell_tickets: true, // Requer PJ VERIFIED
        requires_location: true,
        requires_company: true,
      },
      VENUE: {
        can_publish_events: true,
        can_host_events: true,
        can_define_revenue_split: true,
        can_sell_tickets: true, // Requer PJ VERIFIED
        requires_location: true,
        requires_company: true,
      },
      COLLECTIVE: {
        can_publish_events: true,
        can_host_events: false,
        can_define_revenue_split: true,
        can_sell_tickets: false,
        requires_location: false,
        requires_company: false,
      },
      PRODUCER: {
        can_publish_events: true,
        can_host_events: false,
        can_define_revenue_split: true,
        can_sell_tickets: true, // Requer PJ VERIFIED
        requires_location: false,
        requires_company: false,
      },
      CIRCLE: {
        can_publish_events: true,
        can_host_events: false,
        can_define_revenue_split: true,
        can_sell_tickets: false,
        requires_location: false,
        requires_company: false,
      },
      EDUCATOR: {
        can_publish_events: true,
        can_host_events: false,
        can_define_revenue_split: true,
        can_sell_tickets: true, // Requer PJ VERIFIED
        requires_location: false,
        requires_company: false,
      },
      CURATOR: {
        can_publish_events: false,
        can_host_events: false,
        can_define_revenue_split: false,
        can_sell_tickets: false,
        requires_location: false,
        requires_company: false,
      },
    };

    return capabilities[type];
  }

  /**
   * Cria um novo Perfil de Atuação Cultural (PAC)
   */
  async createProfile(
    tenantId: string,
    input: CreateCulturalProfileInput
  ): Promise<CulturalProfile> {
    // Validar capacidades do tipo
    const capabilities = this.getCapabilitiesByType(input.type);

    // Validar se requer empresa e se foi fornecida
    if (capabilities.requires_company && !input.linked_company_id) {
      throw new Error(`Tipo ${input.type} requer empresa vinculada (linked_company_id)`);
    }

    // Validar se requer localização e se foi fornecida
    if (capabilities.requires_location && !input.location) {
      throw new Error(`Tipo ${input.type} requer localização (location)`);
    }

    // 🔴 VALIDAÇÃO FORTE: Validar hierarquia de localização se location fornecida
    // Nota: location pode ter estrutura flexível (city, state, address, lat, lng)
    // Apenas valida se tiver campos country_id, state_id, city_id
    if (input.location && typeof input.location === 'object') {
      const location = input.location as any;
      if (location.country_id || location.state_id || location.city_id) {
        const { worldService } = await import('@core/world/services/world.service');
        await worldService.validateLocation(
          location.country_id,
          location.state_id,
          location.city_id
        );
      }
    }

    // Validar slug único
    const existing = await runQueriesWithTenant<{ id: string }>(
      tenantId,
      `
      SELECT id
      FROM cultural_profiles
      WHERE tenant_id = $1 AND slug = $2
      LIMIT 1
      `,
      [tenantId, input.slug]
    );

    if (existing && existing.length > 0) {
      throw new Error(`Slug "${input.slug}" já está em uso`);
    }

    // Validar empresa vinculada existe e é VERIFIED (se fornecida)
    if (input.linked_company_id) {
      const company = await runQueriesWithTenant<{ company_status: string }>(
        tenantId,
        `
        SELECT company_status
        FROM companies
        WHERE company_id = $1 AND tenant_id = $2
        LIMIT 1
        `,
        [input.linked_company_id, tenantId]
      );

      if (company.length === 0) {
        throw new Error('Empresa vinculada não encontrada');
      }

      // Para BAR/VENUE, empresa deve ser VERIFIED
      if (capabilities.requires_company && company[0].company_status !== 'VERIFIED' && company[0].company_status !== 'APPROVED') {
        throw new Error('Empresa vinculada deve estar VERIFIED para este tipo de perfil cultural');
      }
    }

    // Criar PAC
    const result = await runQueriesWithTenant<{
      id: string;
      tenant_id: string;
      owner_actor_id: string;
      owner_actor_type: string;
      type: string;
      display_name: string;
      slug: string;
      description: string | null;
      linked_company_id: string | null;
      location: Record<string, any> | null;
      active: boolean;
      createdAt: string;
      updatedAt: string;
    }>(
      tenantId,
      `
      INSERT INTO cultural_profiles (
        tenant_id, owner_actor_id, owner_actor_type, type, display_name, slug,
        description, linked_company_id, location, active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
      RETURNING id, tenant_id, owner_actor_id, owner_actor_type, type, display_name, slug,
                description, linked_company_id, location, active, createdAt, updatedAt
      `,
      [
        tenantId,
        input.owner_actor_id,
        input.owner_actor_type,
        input.type,
        input.display_name,
        input.slug,
        input.description || null,
        input.linked_company_id || null,
        input.location ? JSON.stringify(input.location) : null,
        true,
      ]
    );

    if (!result || result.length === 0) {
      throw new Error('Erro ao criar perfil cultural');
    }

    const row = result[0];
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      owner_actor_id: row.owner_actor_id,
      owner_actor_type: row.owner_actor_type as ActorType,
      type: row.type as CulturalProfileType,
      display_name: row.display_name,
      slug: row.slug,
      description: row.description,
      linked_company_id: row.linked_company_id,
      location: row.location as any,
      isActive: row.active,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Lista PACs de um ator
   */
  async listProfilesByActor(
    tenantId: string,
    actorId: string,
    actorType: ActorType
  ): Promise<CulturalProfile[]> {
    const result = await runQueriesWithTenant<{
      id: string;
      tenant_id: string;
      owner_actor_id: string;
      owner_actor_type: string;
      type: string;
      display_name: string;
      slug: string;
      description: string | null;
      linked_company_id: string | null;
      location: Record<string, any> | null;
      active: boolean;
      createdAt: string;
      updatedAt: string;
    }>(
      tenantId,
      `
      SELECT id, tenant_id, owner_actor_id, owner_actor_type, type, display_name, slug,
             description, linked_company_id, location, active, createdAt, updatedAt
      FROM cultural_profiles
      WHERE tenant_id = $1 AND owner_actor_id = $2 AND owner_actor_type = $3
        AND active = true
      ORDER BY createdAt DESC
      `,
      [tenantId, actorId, actorType]
    );

    return (result || []).map((row) => ({
      id: row.id,
      tenant_id: row.tenant_id,
      owner_actor_id: row.owner_actor_id,
      owner_actor_type: row.owner_actor_type as ActorType,
      type: row.type as CulturalProfileType,
      display_name: row.display_name,
      slug: row.slug,
      description: row.description,
      linked_company_id: row.linked_company_id,
      location: row.location as any,
      isActive: row.active,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  /**
   * Busca PAC por ID
   */
  async getProfile(
    tenantId: string,
    profileId: string
  ): Promise<CulturalProfile | null> {
    const result = await runQueriesWithTenant<{
      id: string;
      tenant_id: string;
      owner_actor_id: string;
      owner_actor_type: string;
      type: string;
      display_name: string;
      slug: string;
      description: string | null;
      linked_company_id: string | null;
      location: Record<string, any> | null;
      active: boolean;
      createdAt: string;
      updatedAt: string;
    }>(
      tenantId,
      `
      SELECT id, tenant_id, owner_actor_id, owner_actor_type, type, display_name, slug,
             description, linked_company_id, location, active, createdAt, updatedAt
      FROM cultural_profiles
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [profileId, tenantId]
    );

    if (!result || result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      owner_actor_id: row.owner_actor_id,
      owner_actor_type: row.owner_actor_type as ActorType,
      type: row.type as CulturalProfileType,
      display_name: row.display_name,
      slug: row.slug,
      description: row.description,
      linked_company_id: row.linked_company_id,
      location: row.location as any,
      isActive: row.active,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

export const culturalProfileService = new CulturalProfileService();




























