// backend/src/core/publication/publication-engine.service.ts
// Motor Canônico de Publicação, Visibilidade e Convites
// ⚠️ REGRAS CANÔNICAS:
// - Separar: VISIBILIDADE (acesso) ≠ PUBLICAÇÃO (destinos) ≠ CONVITE (notificação/envio)
// - Nada de decisões automáticas por categoria/subtipo
// - Database é estado, não verdade; mudanças auditáveis

import { v4 as uuidv4 } from 'uuid';
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { BadRequestError, NotFoundError } from '@core/errors';
import type {
  PublicationMetadata,
  UpsertPublicationMetadataInput,
  GenerateLinkInput,
  GeneratedLink,
  VisibilityContext,
  LogAuditInput,
  CreateReactionInput,
  ReactionCount,
  DestinationRules,
  PublicationDestination,
  Visibility,
  EntityType,
} from './publication-engine.types';

interface PublicationMetadataRow {
  id: string;
  entity_type: string;
  entity_id: string;
  tenant_id: string;
  visibility: string;
  publication_destinations: string[];
  invitations_enabled: boolean;
  invitation_methods: string[];
  referral_code: string | null;
  created_by_actor_id: string;
  created_by_actor_type: string;
  createdAt: string;
  updatedAt: string;
}

class PublicationEngineService {
  /**
   * Determina destinos de publicação baseado em regras explícitas
   * NÃO usa categoria/subtipo para decisão automática
   */
  determineDestinations(
    visibility: Visibility,
    entityType: EntityType,
    actorType: 'user' | 'page' | 'group' | 'channel'
  ): PublicationDestination[] {
    // Regras explícitas por visibilidade (não por categoria)
    const rules: Record<Visibility, PublicationDestination[]> = {
      public: ['feed', 'profile', 'search'],
      private: ['profile'], // Apenas no perfil do criador
      unlisted: ['profile'], // Não aparece em feeds ou busca
      followers: ['feed', 'profile'], // Apenas para seguidores
      group: ['group_feed', 'profile'], // Apenas no feed do grupo
      friends: ['feed', 'profile'], // Apenas para amigos
    };

    const baseDestinations = rules[visibility] || ['profile'];

    // Ajustes por tipo de entidade (regras explícitas)
    if (entityType === 'event') {
      // Eventos sempre aparecem no event_feed se público
      if (visibility === 'public' || visibility === 'followers') {
        return [...baseDestinations, 'event_feed'];
      }
    }

    // Ajustes por tipo de actor (regras explícitas)
    if (actorType === 'page') {
      // Páginas podem ter destinos adicionais
      if (visibility === 'public') {
        return [...baseDestinations, 'search'];
      }
    }

    return baseDestinations;
  }

  /**
   * Cria ou atualiza metadados de publicação
   */
  async upsertPublicationMetadata(
    tenantId: string,
    actorId: string,
    actorType: 'user' | 'page' | 'group' | 'channel',
    input: UpsertPublicationMetadataInput
  ): Promise<PublicationMetadata> {
    // Determinar destinos se não fornecidos
    const destinations = input.publication_destinations || 
      this.determineDestinations(
        input.visibility || 'public',
        input.entity_type,
        actorType
      );

    // Buscar metadados existentes
    const existing = await this.getPublicationMetadata(
      tenantId,
      input.entity_type,
      input.entity_id
    );

    if (existing) {
      // Atualizar existente
      const oldVisibility = existing.visibility;
      const oldDestinations = existing.publication_destinations;
      const oldInvitationsEnabled = existing.invitations_enabled;
      const oldInvitationMethods = existing.invitation_methods;

      const updates: Partial<PublicationMetadataRow> = {};
      if (input.visibility !== undefined) updates.visibility = input.visibility;
      if (input.publication_destinations !== undefined) {
        updates.publication_destinations = JSON.stringify(input.publication_destinations);
      }
      if (input.invitations_enabled !== undefined) {
        updates.invitations_enabled = input.invitations_enabled;
      }
      if (input.invitation_methods !== undefined) {
        updates.invitation_methods = JSON.stringify(input.invitation_methods);
      }
      if (input.referral_code !== undefined) updates.referral_code = input.referral_code;

      const updateFields = Object.keys(updates)
        .map((key, idx) => `${key} = $${idx + 3}`)
        .join(', ');

      const values = [
        tenantId,
        input.entity_type,
        input.entity_id,
        ...Object.values(updates),
      ];

      const updateQuery = `UPDATE publication_metadata 
         SET ${updateFields}, updatedAt = NOW()
         WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3`;
      
      await runQueryWithTenant(tenantId, updateQuery, values);

      // Logar auditoria
      if (input.visibility !== undefined && input.visibility !== oldVisibility) {
        await this.logAudit(tenantId, {
          entity_type: input.entity_type,
          entity_id: input.entity_id,
          action: 'SET_VISIBILITY',
          payload: {
            old_visibility: oldVisibility,
            new_visibility: input.visibility,
          },
          actor_id: actorId,
          actor_type: actorType,
        });
      }

      if (input.publication_destinations !== undefined) {
        await this.logAudit(tenantId, {
          entity_type: input.entity_type,
          entity_id: input.entity_id,
          action: 'SET_DESTINATIONS',
          payload: {
            old_destinations: oldDestinations,
            new_destinations: input.publication_destinations,
          },
          actor_id: actorId,
          actor_type: actorType,
        });
      }

      if (input.invitations_enabled !== undefined && input.invitations_enabled !== oldInvitationsEnabled) {
        await this.logAudit(tenantId, {
          entity_type: input.entity_type,
          entity_id: input.entity_id,
          action: input.invitations_enabled ? 'ENABLE_INVITATIONS' : 'DISABLE_INVITATIONS',
          payload: {},
          actor_id: actorId,
          actor_type: actorType,
        });
      }

      if (input.invitation_methods !== undefined) {
        await this.logAudit(tenantId, {
          entity_type: input.entity_type,
          entity_id: input.entity_id,
          action: 'SET_INVITATION_METHODS',
          payload: {
            old_methods: oldInvitationMethods,
            new_methods: input.invitation_methods,
          },
          actor_id: actorId,
          actor_type: actorType,
        });
      }

      const updated = await this.getPublicationMetadata(tenantId, input.entity_type, input.entity_id);
      if (!updated) {
        throw new NotFoundError('Failed to retrieve updated metadata');
      }
      return updated;
    } else {
      // Criar novo
      const metadataId = uuidv4();
      const visibility = input.visibility || 'public';
      const invitationsEnabled = input.invitations_enabled || false;
      const invitationMethods = input.invitation_methods || [];

      await runQueryWithTenant(
        tenantId,
        `INSERT INTO publication_metadata (
          id, entity_type, entity_id, tenant_id,
          visibility, publication_destinations, invitations_enabled,
          invitation_methods, referral_code,
          created_by_actor_id, created_by_actor_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          metadataId,
          input.entity_type,
          input.entity_id,
          tenantId,
          visibility,
          JSON.stringify(destinations),
          invitationsEnabled,
          JSON.stringify(invitationMethods),
          input.referral_code || null,
          actorId,
          actorType,
        ]
      );

      // Logar auditoria inicial
      await this.logAudit(tenantId, {
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        action: 'SET_VISIBILITY',
        payload: { visibility },
        actor_id: actorId,
        actor_type: actorType,
      });

      const updated = await this.getPublicationMetadata(tenantId, input.entity_type, input.entity_id);
      if (!updated) {
        throw new NotFoundError('Failed to retrieve updated metadata');
      }
      return updated;
    }
  }

  /**
   * Busca metadados de publicação
   */
  async getPublicationMetadata(
    tenantId: string,
    entityType: EntityType,
    entityId: string
  ): Promise<PublicationMetadata | null> {
    const result = await runQueryWithTenant<PublicationMetadataRow>(
      tenantId,
      `SELECT * FROM publication_metadata 
       WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3`,
      [tenantId, entityType, entityId]
    );

    if (!result) return null;

    const row = result as PublicationMetadataRow;
    return {
      id: row.id,
      entity_type: row.entity_type as EntityType,
      entity_id: row.entity_id,
      tenant_id: row.tenant_id,
      visibility: row.visibility as Visibility,
      publication_destinations: row.publication_destinations as PublicationDestination[],
      invitations_enabled: row.invitations_enabled,
      invitation_methods: row.invitation_methods as any[],
      referral_code: row.referral_code,
      created_by_actor_id: row.created_by_actor_id,
      created_by_actor_type: row.created_by_actor_type as any,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Gera link compartilhável com referral opcional
   */
  async generateShareableLink(
    tenantId: string,
    actorId: string,
    actorType: 'user' | 'page' | 'group' | 'channel',
    input: GenerateLinkInput
  ): Promise<GeneratedLink> {
    const metadata = await this.getPublicationMetadata(
      tenantId,
      input.entity_type,
      input.entity_id
    );

    if (!metadata) {
      throw new NotFoundError('Publication metadata not found');
    }

    // Usar referral_code fornecido ou do metadata ou gerar novo
    let referralCode = input.referral_code || metadata.referral_code;
    
    // Se não existe, buscar do actor (futuro: buscar código de indicação do actor)
    // Por enquanto, usar null se não fornecido

    // Construir URL base
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    let url = `${baseUrl}/${input.entity_type === 'event' ? 'events' : input.entity_type}s/${input.entity_id}`;

    // Adicionar referral se existir
    if (referralCode) {
      url += `?ref=${referralCode}`;
    }

    // Logar auditoria
    await this.logAudit(tenantId, {
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      action: 'GENERATE_LINK',
      payload: {
        link: url,
        referral_code: referralCode,
        expiresAt: input.expiresAt,
      },
      actor_id: actorId,
      actor_type: actorType,
    });

    return {
      url,
      referral_code: referralCode,
      expiresAt: input.expiresAt || null,
    };
  }

  /**
   * Verifica se usuário pode ver a entidade (somente regra de visibilidade)
   */
  canUserSee(
    metadata: PublicationMetadata,
    context: VisibilityContext
  ): boolean {
    switch (metadata.visibility) {
      case 'public':
        return true;
      case 'private':
        // Apenas o criador pode ver
        return context.actor_id === metadata.created_by_actor_id;
      case 'unlisted':
        // Apenas quem tem o link pode ver (verificação de acesso é feita em outro lugar)
        return true; // Link-based access é verificado na rota
      case 'followers':
        return context.is_follower === true;
      case 'group':
        return context.group_id !== undefined; // Verificação de membro do grupo é feita em outro lugar
      case 'friends':
        return context.is_friend === true;
      default:
        return false;
    }
  }

  /**
   * Loga ação de auditoria (append-only)
   */
  async logAudit(tenantId: string, input: LogAuditInput): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `INSERT INTO publication_audit_log (
        entity_type, entity_id, tenant_id, action, payload,
        actor_id, actor_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        input.entity_type,
        input.entity_id,
        tenantId,
        input.action,
        JSON.stringify(input.payload),
        input.actor_id,
        input.actor_type,
      ]
    );
  }

  /**
   * Cria ou atualiza reação
   */
  async upsertReaction(
    tenantId: string,
    userId: string,
    input: CreateReactionInput
  ): Promise<void> {
    // Verificar se já existe reação
    const existing = await runQueryWithTenant<{ id: string; reaction_type: string }>(
      tenantId,
      `SELECT id, reaction_type FROM reactions 
       WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3 AND user_id = $4`,
      [tenantId, input.entity_type, input.entity_id, userId]
    );

    if (existing) {
      // Atualizar reação existente
      if (existing.reaction_type !== input.reaction_type) {
        await runQueryWithTenant(
          tenantId,
          `UPDATE reactions 
           SET reaction_type = $1 
           WHERE tenant_id = $2 AND entity_type = $3 AND entity_id = $4 AND user_id = $5`,
          [input.reaction_type, tenantId, input.entity_type, input.entity_id, userId]
        );
      }
    } else {
      // Criar nova reação
      await runQueryWithTenant(
        tenantId,
        `INSERT INTO reactions (
          entity_type, entity_id, tenant_id, reaction_type, user_id, actor_id
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          input.entity_type,
          input.entity_id,
          tenantId,
          input.reaction_type,
          userId,
          input.actor_id || null,
        ]
      );
    }

    // Logar auditoria
    await this.logAudit(tenantId, {
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      action: 'REACTION',
      payload: {
        reaction_type: input.reaction_type,
        user_id: userId,
        actor_id: input.actor_id,
      },
      actor_id: userId,
      actor_type: 'user',
    });
  }

  /**
   * Remove reação
   */
  async removeReaction(
    tenantId: string,
    userId: string,
    entityType: EntityType,
    entityId: string
  ): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `DELETE FROM reactions 
       WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3 AND user_id = $4`,
      [tenantId, entityType, entityId, userId]
    );
  }

  /**
   * Busca contagens de reações
   */
  async getReactionCounts(
    tenantId: string,
    entityType: EntityType,
    entityId: string
  ): Promise<ReactionCount[]> {
    const results = await runQueriesWithTenant<{ reaction_type: string; count: number }>(
      tenantId,
      `SELECT reaction_type, count 
       FROM reaction_counts 
       WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3`,
      [tenantId, entityType, entityId]
    );

    if (!results) return [];

    return results.map(row => ({
      reaction_type: row.reaction_type as any,
      count: row.count,
    }));
  }
}

export const publicationEngineService = new PublicationEngineService();


