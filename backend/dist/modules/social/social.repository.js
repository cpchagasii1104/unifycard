"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialRepository = void 0;
// src/modules/social/social.repository.ts
const pool_1 = require("@core/database/pool");
class SocialRepository {
    /**
     * Busca post por ID
     */
    async findById(tenantId, postId) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT post_id, tenant_id, global_user_id, content, type, visibility, media, intent, confidence, categories, suggested_actions, metadata, event_id, created_at, updated_at
      FROM posts
      WHERE post_id = $1
      LIMIT 1
      `, [postId]);
        return row || null;
    }
    /**
     * Cria um novo post
     */
    async create(data) {
        const row = await (0, pool_1.runQueryWithTenant)(data.tenantId, `
      INSERT INTO posts (
        tenant_id,
        global_user_id,
        content,
        type,
        visibility,
        media,
        intent,
        confidence,
        categories,
        suggested_actions,
        metadata,
        event_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING post_id, tenant_id, global_user_id, content, type, visibility, media, intent, confidence, categories, suggested_actions, metadata, event_id, created_at, updated_at
      `, [
            data.tenantId,
            data.globalUserId,
            data.content,
            data.type || 'TEXT',
            data.visibility || 'PUBLIC',
            JSON.stringify(data.media),
            data.intent,
            data.confidence,
            data.categories,
            JSON.stringify(data.suggestedActions),
            JSON.stringify(data.metadata),
            data.eventId || null,
        ]);
        if (!row) {
            throw new Error('Falha ao criar post');
        }
        return row;
    }
    /**
     * Busca feed de posts
     */
    async findFeed(tenantId, options = {}) {
        const { limit = 50, offset = 0, categoryId, intent, userId, groupId, startDate, endDate, } = options;
        let query = `
      SELECT post_id, tenant_id, global_user_id, content, type, visibility, media, intent, confidence, categories, suggested_actions, metadata, event_id, created_at, updated_at
      FROM posts
      WHERE tenant_id = $1
    `;
        const params = [tenantId];
        let paramIndex = 2;
        if (categoryId) {
            query += ` AND $${paramIndex} = ANY(categories)`;
            params.push(categoryId);
            paramIndex++;
        }
        if (intent) {
            query += ` AND intent = $${paramIndex}`;
            params.push(intent);
            paramIndex++;
        }
        if (userId) {
            query += ` AND global_user_id = $${paramIndex}`;
            params.push(userId);
            paramIndex++;
        }
        if (groupId) {
            query += ` AND metadata->>'groupId' = $${paramIndex}`;
            params.push(groupId);
            paramIndex++;
        }
        if (startDate) {
            query += ` AND created_at >= $${paramIndex}`;
            params.push(startDate);
            paramIndex++;
        }
        if (endDate) {
            query += ` AND created_at <= $${paramIndex}`;
            params.push(endDate);
            paramIndex++;
        }
        query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);
        const rows = await (0, pool_1.runQueriesWithTenant)(tenantId, query, params);
        // Contar total
        let countQuery = `SELECT COUNT(*) as total FROM posts WHERE tenant_id = $1`;
        const countParams = [tenantId];
        let countParamIndex = 2;
        if (categoryId) {
            countQuery += ` AND $${countParamIndex} = ANY(categories)`;
            countParams.push(categoryId);
            countParamIndex++;
        }
        if (intent) {
            countQuery += ` AND intent = $${countParamIndex}`;
            countParams.push(intent);
            countParamIndex++;
        }
        if (userId) {
            countQuery += ` AND global_user_id = $${countParamIndex}`;
            countParams.push(userId);
            countParamIndex++;
        }
        if (groupId) {
            countQuery += ` AND metadata->>'groupId' = $${countParamIndex}`;
            countParams.push(groupId);
            countParamIndex++;
        }
        if (startDate) {
            countQuery += ` AND created_at >= $${countParamIndex}`;
            countParams.push(startDate);
            countParamIndex++;
        }
        if (endDate) {
            countQuery += ` AND created_at <= $${countParamIndex}`;
            countParams.push(endDate);
            countParamIndex++;
        }
        const countRow = await (0, pool_1.runQueryWithTenant)(tenantId, countQuery, countParams);
        return {
            rows,
            total: countRow ? Number(countRow.total) : 0,
        };
    }
    /**
     * Atualiza metadata de um post
     */
    async updateMetadata(tenantId, postId, metadata) {
        await (0, pool_1.runQueryWithTenant)(tenantId, `
      UPDATE posts
      SET metadata = $1, updated_at = now()
      WHERE post_id = $2
      `, [JSON.stringify(metadata), postId]);
    }
}
exports.SocialRepository = SocialRepository;
//# sourceMappingURL=social.repository.js.map