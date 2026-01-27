"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryRepository = void 0;
// src/core/memory/memory.repository.ts
const pool_1 = require("@core/database/pool");
class MemoryRepository {
    /**
     * Busca ou cria preferência
     */
    async upsertPreference(data) {
        const row = await (0, pool_1.runQueryWithTenant)(data.tenantId, `
      INSERT INTO user_memory_preferences (tenant_id, global_user_id, category, key, value, confidence, usage_count, last_used_at)
      VALUES ($1, $2, $3, $4, $5, $6, 1, now())
      ON CONFLICT (tenant_id, global_user_id, category, key)
      DO UPDATE SET
        value = EXCLUDED.value,
        confidence = EXCLUDED.confidence,
        usage_count = user_memory_preferences.usage_count + 1,
        last_used_at = now(),
        updated_at = now()
      RETURNING preference_id, tenant_id, global_user_id, category, key, value, confidence, usage_count, last_used_at, created_at, updated_at
      `, [
            data.tenantId,
            data.globalUserId,
            data.category,
            data.key,
            JSON.stringify(data.value),
            data.confidence ?? 1.0,
        ]);
        if (!row) {
            throw new Error('Falha ao salvar preferência');
        }
        return row;
    }
    /**
     * Busca preferências do usuário
     */
    async findPreferencesByUser(tenantId, globalUserId, category) {
        let query = `
      SELECT preference_id, tenant_id, global_user_id, category, key, value, confidence, usage_count, last_used_at, created_at, updated_at
      FROM user_memory_preferences
      WHERE global_user_id = $1
    `;
        const params = [globalUserId];
        if (category) {
            query += ` AND category = $2`;
            params.push(category);
        }
        query += ` ORDER BY last_used_at DESC`;
        return await (0, pool_1.runQueriesWithTenant)(tenantId, query, params);
    }
    /**
     * Busca ou cria interação
     */
    async upsertInteraction(data) {
        const row = await (0, pool_1.runQueryWithTenant)(data.tenantId, `
      INSERT INTO user_memory_interactions (tenant_id, global_user_id, intent, entity_type, entity_id, entity_name, parameters, interaction_count, first_interaction_at, last_interaction_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 1, now(), now())
      ON CONFLICT DO NOTHING
      RETURNING interaction_id, tenant_id, global_user_id, intent, entity_type, entity_id, entity_name, parameters, interaction_count, first_interaction_at, last_interaction_at, created_at, updated_at
      `, [
            data.tenantId,
            data.globalUserId,
            data.intent,
            data.entityType,
            data.entityId ?? null,
            data.entityName ?? null,
            JSON.stringify(data.parameters),
        ]);
        if (!row) {
            // Se não inseriu (conflito), buscar existente e atualizar
            const existing = await (0, pool_1.runQueryWithTenant)(data.tenantId, `
        SELECT interaction_id, tenant_id, global_user_id, intent, entity_type, entity_id, entity_name, parameters, interaction_count, first_interaction_at, last_interaction_at, created_at, updated_at
        FROM user_memory_interactions
        WHERE global_user_id = $1 AND intent = $2 AND entity_type = $3 AND (entity_id = $4 OR (entity_id IS NULL AND $4 IS NULL))
        LIMIT 1
        `, [data.globalUserId, data.intent, data.entityType, data.entityId ?? null]);
            if (existing) {
                // Atualizar contador
                const updated = await (0, pool_1.runQueryWithTenant)(data.tenantId, `
          UPDATE user_memory_interactions
          SET interaction_count = interaction_count + 1,
              last_interaction_at = now(),
              updated_at = now()
          WHERE interaction_id = $1
          RETURNING interaction_id, tenant_id, global_user_id, intent, entity_type, entity_id, entity_name, parameters, interaction_count, first_interaction_at, last_interaction_at, created_at, updated_at
          `, [existing.interaction_id]);
                return updated || existing;
            }
        }
        if (!row) {
            throw new Error('Falha ao salvar interação');
        }
        return row;
    }
    /**
     * Busca interações recentes do usuário
     */
    async findRecentInteractions(tenantId, globalUserId, limit = 10) {
        return await (0, pool_1.runQueriesWithTenant)(tenantId, `
      SELECT interaction_id, tenant_id, global_user_id, intent, entity_type, entity_id, entity_name, parameters, interaction_count, first_interaction_at, last_interaction_at, created_at, updated_at
      FROM user_memory_interactions
      WHERE global_user_id = $1
      ORDER BY last_interaction_at DESC
      LIMIT $2
      `, [globalUserId, limit]);
    }
    /**
     * Busca ou cria entidade
     */
    async upsertEntity(data) {
        const row = await (0, pool_1.runQueryWithTenant)(data.tenantId, `
      INSERT INTO user_memory_entities (tenant_id, global_user_id, entity_type, target_global_user_id, target_company_id, entity_name, entity_metadata, relevance_score, interaction_count, last_interaction_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, now())
      ON CONFLICT DO NOTHING
      RETURNING entity_id, tenant_id, global_user_id, entity_type, target_global_user_id, target_company_id, entity_name, entity_metadata, relevance_score, interaction_count, last_interaction_at, created_at, updated_at
      `, [
            data.tenantId,
            data.globalUserId,
            data.entityType,
            data.targetGlobalUserId ?? null,
            data.targetCompanyId ?? null,
            data.entityName,
            JSON.stringify(data.entityMetadata),
            data.relevanceScore ?? 1.0,
        ]);
        if (!row) {
            // Se não inseriu, buscar existente e atualizar
            const existing = await (0, pool_1.runQueryWithTenant)(data.tenantId, `
        SELECT entity_id, tenant_id, global_user_id, entity_type, target_global_user_id, target_company_id, entity_name, entity_metadata, relevance_score, interaction_count, last_interaction_at, created_at, updated_at
        FROM user_memory_entities
        WHERE global_user_id = $1 AND entity_type = $2 AND (target_global_user_id = $3 OR (target_global_user_id IS NULL AND $3 IS NULL)) AND (target_company_id = $4 OR (target_company_id IS NULL AND $4 IS NULL))
        LIMIT 1
        `, [data.globalUserId, data.entityType, data.targetGlobalUserId ?? null, data.targetCompanyId ?? null]);
            if (existing) {
                // Atualizar contador e relevância
                const updated = await (0, pool_1.runQueryWithTenant)(data.tenantId, `
          UPDATE user_memory_entities
          SET interaction_count = interaction_count + 1,
              relevance_score = LEAST(relevance_score + 0.1, 1.0),
              last_interaction_at = now(),
              updated_at = now()
          WHERE entity_id = $1
          RETURNING entity_id, tenant_id, global_user_id, entity_type, target_global_user_id, target_company_id, entity_name, entity_metadata, relevance_score, interaction_count, last_interaction_at, created_at, updated_at
          `, [existing.entity_id]);
                return updated || existing;
            }
        }
        if (!row) {
            throw new Error('Falha ao salvar entidade');
        }
        return row;
    }
    /**
     * Busca entidades frequentes do usuário
     */
    async findFrequentEntities(tenantId, globalUserId, entityType, limit = 10) {
        let query = `
      SELECT entity_id, tenant_id, global_user_id, entity_type, target_global_user_id, target_company_id, entity_name, entity_metadata, relevance_score, interaction_count, last_interaction_at, created_at, updated_at
      FROM user_memory_entities
      WHERE global_user_id = $1
    `;
        const params = [globalUserId];
        if (entityType) {
            query += ` AND entity_type = $2`;
            params.push(entityType);
            params.push(limit);
        }
        else {
            params.push(limit);
        }
        query += ` ORDER BY relevance_score DESC, last_interaction_at DESC LIMIT $${params.length}`;
        return await (0, pool_1.runQueriesWithTenant)(tenantId, query, params);
    }
    /**
     * Busca ou cria shortcut
     */
    async upsertShortcut(data) {
        const row = await (0, pool_1.runQueryWithTenant)(data.tenantId, `
      INSERT INTO user_memory_shortcuts (tenant_id, global_user_id, label, intent, parameters, usage_count, last_used_at)
      VALUES ($1, $2, $3, $4, $5, 1, now())
      ON CONFLICT DO NOTHING
      RETURNING shortcut_id, tenant_id, global_user_id, label, intent, parameters, usage_count, last_used_at, created_at, updated_at
      `, [
            data.tenantId,
            data.globalUserId,
            data.label,
            data.intent,
            JSON.stringify(data.parameters),
        ]);
        if (!row) {
            // Se não inseriu, buscar existente e atualizar
            const existing = await (0, pool_1.runQueryWithTenant)(data.tenantId, `
        SELECT shortcut_id, tenant_id, global_user_id, label, intent, parameters, usage_count, last_used_at, created_at, updated_at
        FROM user_memory_shortcuts
        WHERE global_user_id = $1 AND intent = $2 AND parameters::text = $3
        LIMIT 1
        `, [data.globalUserId, data.intent, JSON.stringify(data.parameters)]);
            if (existing) {
                // Atualizar contador
                const updated = await (0, pool_1.runQueryWithTenant)(data.tenantId, `
          UPDATE user_memory_shortcuts
          SET usage_count = usage_count + 1,
              last_used_at = now(),
              updated_at = now()
          WHERE shortcut_id = $1
          RETURNING shortcut_id, tenant_id, global_user_id, label, intent, parameters, usage_count, last_used_at, created_at, updated_at
          `, [existing.shortcut_id]);
                return updated || existing;
            }
        }
        if (!row) {
            throw new Error('Falha ao salvar shortcut');
        }
        return row;
    }
    /**
     * Busca shortcuts sugeridos do usuário
     */
    async findSuggestedShortcuts(tenantId, globalUserId, limit = 10) {
        return await (0, pool_1.runQueriesWithTenant)(tenantId, `
      SELECT shortcut_id, tenant_id, global_user_id, label, intent, parameters, usage_count, last_used_at, created_at, updated_at
      FROM user_memory_shortcuts
      WHERE global_user_id = $1
      ORDER BY usage_count DESC, last_used_at DESC
      LIMIT $2
      `, [globalUserId, limit]);
    }
}
exports.MemoryRepository = MemoryRepository;
