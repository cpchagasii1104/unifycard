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
  /** Gate marketplace (PERMISSION_CAPABILITIES / authorization.service). */
  can_manage_marketplace?: boolean;
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

    // 🔀 SOFT-BLOCK (Fase 3): Buscar capabilities antigas para log de UPDATE (se existir)
    const existingRegistry = await this.findByActorId(tenantId, actorId);
    const oldCapabilities = existingRegistry?.capabilities || {};
    const isUpdate = !!existingRegistry;

    // 🔀 SOFT-BLOCK (Fase 3): Validar capabilities antes do INSERT (bloqueia CREATE)
    // UPDATE apenas loga, não bloqueia
    const { softBlockService } = await import('@core/authorization/soft-block.service');
    if (!isUpdate) {
      // Apenas valida (bloqueia) em CREATE
      softBlockService.validateCapabilities(finalCapabilities, {
        tenantId,
        actorId,
        requestId: undefined, // TODO: extrair de request se disponível
      });
    }

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

    // 🔀 SOFT-BLOCK (Fase 3): Logar update de capabilities (LOG ONLY, não bloqueia)
    // Se é UPDATE (existia antes), logar se capabilities aumentaram poder
    if (existingRegistry) {
      softBlockService.logCapabilitiesUpdate(
        oldCapabilities,
        finalCapabilities,
        {
          tenantId,
          actorId,
          requestId: undefined, // TODO: extrair de request se disponível
        }
      );
    }

    return {
      registryId: result?.registry_id ?? '',
      tenantId: result?.tenant_id ?? '',
      actorId: result?.actor_id ?? '',
      actorType: (result?.actor_type as ActorRegistryType) ?? 'company',
      entityTable: result?.entity_table ?? '',
      entityId: result?.entity_id ?? '',
      capabilities: result?.capabilities_json ?? {},
      createdAt: result?.created_at ?? new Date(),
      updatedAt: result?.updated_at ?? new Date(),
    };
  }

  /**
   * Busca registry por actor_id
   */
  async findByActorId(
    tenantId: string,
    actorId: string,
    existingClient?: { query(text: string, params?: unknown[]): Promise<{ rows: unknown[] }> }
  ): Promise<ActorRegistryEntry | null> {
    type RegistryRow = {
      registry_id: string;
      tenant_id: string;
      actor_id: string;
      actor_type: string;
      entity_table: string;
      entity_id: string;
      capabilities_json: any;
      created_at: Date;
      updated_at: Date;
    };
    // 🔒 TRANSACTION-AWARE (remediação D9.1): com `existingClient`, a MESMA consulta roda no client
    // do caller com a linha FOR SHARE (evidência do ramo registry serializada). Sem client, pool intacto.
    let row: RegistryRow | undefined;
    if (existingClient) {
      const res = await existingClient.query(
        `SELECT * FROM actor_registry WHERE tenant_id = $1 AND actor_id = $2 LIMIT 1 FOR SHARE`,
        [tenantId, actorId]
      );
      row = res.rows[0] as RegistryRow | undefined;
    } else {
      row = await runQueryWithTenant<RegistryRow>(
        tenantId,
        `
        SELECT *
        FROM actor_registry
        WHERE tenant_id = $1 AND actor_id = $2
        LIMIT 1
      `,
        [tenantId, actorId]
      );
    }

    if (!row) {
      return null;
    }

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
    const row = await runQueryWithTenant<{
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

    if (!row) {
      return null;
    }

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
          can_manage_marketplace: true,
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





