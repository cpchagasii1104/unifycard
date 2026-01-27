// backend/src/core/actor-registry/actor-registry.service.ts
// CONTINUOUS PRODUCTION: Actor Registry Service
// Adapter que mapeia entidades existentes para actors com capabilities

import { runQueryWithTenant } from '@core/database/pool';
import { socialPortsRegistry } from '@core/social/ports-registry';

export type ActorRegistryType = 'company' | 'event' | 'group' | 'service' | 'project';

export interface ActorCapabilities {
  can_receive_funds?: boolean;
  can_publish_feed?: boolean;
  can_delegate?: boolean;
  can_hold_assets?: boolean;
  can_create_events?: boolean;
  can_manage_members?: boolean;
  [key: string]: any;
}

export interface ActorRegistryEntry {
  registryId: string;
  tenantId: string;
  actorId: string;
  actorType: ActorRegistryType;
  entityTable: string;
  entityId: string;
  capabilities: ActorCapabilities;
  createdAt: Date;
  updatedAt: Date;
}

class ActorRegistryService {
  /**
   * Registra ou atualiza entrada no registry
   */
  async register(
    tenantId: string,
    actorId: string,
    actorType: ActorRegistryType,
    entityTable: string,
    entityId: string,
    capabilities: ActorCapabilities = {}
  ): Promise<ActorRegistryEntry> {
    // Verificar se actor existe
    const actorRepository = socialPortsRegistry.getActorRepository();
    const actor = await actorRepository.findById(tenantId, actorId);
    if (!actor) {
      throw new Error(`Actor ${actorId} not found`);
    }

    // Default capabilities baseado no tipo
    const defaultCapabilities = this.getDefaultCapabilities(actorType);
    const finalCapabilities = { ...defaultCapabilities, ...capabilities };

    const result = await runQueryWithTenant<{
      registry_id: string;
      tenant_id: string;
      actor_id: string;
      actor_type: string;
      entity_table: string;
      entity_id: string;
      capabilities_json: any;
      created_at: Date;
      updated_at: Date;
    }>(
      tenantId,
      `
        INSERT INTO actor_registry (
          tenant_id, actor_id, actor_type, entity_table, entity_id, capabilities_json
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (tenant_id, actor_id)
        DO UPDATE SET
          actor_type = EXCLUDED.actor_type,
          entity_table = EXCLUDED.entity_table,
          entity_id = EXCLUDED.entity_id,
          capabilities_json = EXCLUDED.capabilities_json,
          updated_at = NOW()
        RETURNING *
      `,
      [tenantId, actorId, actorType, entityTable, entityId, JSON.stringify(finalCapabilities)]
    );

    return {
      registryId: result[0].registry_id,
      tenantId: result[0].tenant_id,
      actorId: result[0].actor_id,
      actorType: result[0].actor_type as ActorRegistryType,
      entityTable: result[0].entity_table,
      entityId: result[0].entity_id,
      capabilities: result[0].capabilities_json,
      createdAt: result[0].created_at,
      updatedAt: result[0].updated_at,
    };
  }

  /**
   * Busca registry por actor_id
   */
  async findByActorId(
    tenantId: string,
    actorId: string
  ): Promise<ActorRegistryEntry | null> {
    const result = await runQueryWithTenant<{
      registry_id: string;
      tenant_id: string;
      actor_id: string;
      actor_type: string;
      entity_table: string;
      entity_id: string;
      capabilities_json: any;
      created_at: Date;
      updated_at: Date;
    }>(
      tenantId,
      `
        SELECT *
        FROM actor_registry
        WHERE tenant_id = $1 AND actor_id = $2
        LIMIT 1
      `,
      [tenantId, actorId]
    );

    if (!result || result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      registryId: row.registry_id,
      tenantId: row.tenant_id,
      actorId: row.actor_id,
      actorType: row.actor_type as ActorRegistryType,
      entityTable: row.entity_table,
      entityId: row.entity_id,
      capabilities: row.capabilities_json,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Busca registry por entidade
   */
  async findByEntity(
    tenantId: string,
    entityTable: string,
    entityId: string
  ): Promise<ActorRegistryEntry | null> {
    const result = await runQueryWithTenant<{
      registry_id: string;
      tenant_id: string;
      actor_id: string;
      actor_type: string;
      entity_table: string;
      entity_id: string;
      capabilities_json: any;
      created_at: Date;
      updated_at: Date;
    }>(
      tenantId,
      `
        SELECT *
        FROM actor_registry
        WHERE tenant_id = $1 AND entity_table = $2 AND entity_id = $3
        LIMIT 1
      `,
      [tenantId, entityTable, entityId]
    );

    if (!result || result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      registryId: row.registry_id,
      tenantId: row.tenant_id,
      actorId: row.actor_id,
      actorType: row.actor_type as ActorRegistryType,
      entityTable: row.entity_table,
      entityId: row.entity_id,
      capabilities: row.capabilities_json,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Obtém capabilities padrão por tipo de actor
   */
  private getDefaultCapabilities(actorType: ActorRegistryType): ActorCapabilities {
    switch (actorType) {
      case 'company':
        return {
          can_receive_funds: true,
          can_publish_feed: true,
          can_delegate: true,
          can_hold_assets: true,
          can_create_events: true,
          can_manage_members: true,
        };
      case 'event':
        return {
          can_receive_funds: true,
          can_publish_feed: true,
          can_delegate: false,
          can_hold_assets: false,
          can_create_events: false,
        };
      case 'group':
        return {
          can_receive_funds: true,
          can_publish_feed: true,
          can_delegate: false,
          can_hold_assets: true,
          can_manage_members: true,
        };
      case 'service':
        return {
          can_receive_funds: true,
          can_publish_feed: true,
          can_delegate: false,
          can_hold_assets: false,
        };
      case 'project':
        return {
          can_receive_funds: true,
          can_publish_feed: true,
          can_delegate: false,
          can_hold_assets: false,
        };
      default:
        return {};
    }
  }
}

export const actorRegistryService = new ActorRegistryService();




