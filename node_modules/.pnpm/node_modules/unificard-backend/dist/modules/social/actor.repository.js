"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.actorRepository = exports.ActorRepository = void 0;
// src/modules/social/actor.repository.ts
const pool_1 = require("@core/database/pool");
class ActorRepository {
    /**
     * Busca actor por ID
     */
    async findById(tenantId, actorId) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT actor_id, tenant_id, actor_type, user_id, company_id, group_id,
             display_name, slug, avatar_url, cover_url, bio, metadata,
             created_at, updated_at
      FROM actors
      WHERE actor_id = $1
      LIMIT 1
      `, [actorId]);
        return row || null;
    }
    /**
     * Busca ou cria actor para um usuário
     */
    async findOrCreateUserActor(tenantId, userId, globalUserId) {
        // Primeiro tenta encontrar
        // FASE 3.6: Corrigir JOIN - buscar user_id através de user_identity_links ou global_user_id em users
        const existing = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT a.*
      FROM actors a
      JOIN users u ON a.user_id = u.user_id
      WHERE a.tenant_id = $1 
        AND (u.global_user_id = $2 OR EXISTS (
          SELECT 1 FROM user_identity_links uil 
          WHERE uil.user_id = u.user_id AND uil.global_user_id = $2
        ))
        AND a.actor_type = 'user'
      LIMIT 1
      `, [tenantId, globalUserId]);
        if (existing) {
            return existing;
        }
        // Busca nome do usuário
        const user = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT u.email, p.full_name
      FROM users u
      LEFT JOIN profiles p ON u.user_id = p.user_id AND u.tenant_id = p.tenant_id
      WHERE u.user_id = $1
      LIMIT 1
      `, [userId]);
        if (!user) {
            throw new Error('Usuário não encontrado');
        }
        const displayName = user.full_name || user.email.split('@')[0];
        // Cria novo actor
        const newActor = await (0, pool_1.runQueryWithTenant)(tenantId, `
      INSERT INTO actors (
        tenant_id, actor_type, user_id, display_name, slug
      )
      VALUES ($1, 'user', $2, $3, $4)
      RETURNING *
      `, [tenantId, userId, displayName, `user-${globalUserId.substring(0, 8)}`]);
        if (!newActor) {
            throw new Error('Erro ao criar actor');
        }
        return newActor;
    }
    /**
     * Busca ou cria actor para uma empresa (page)
     */
    async findOrCreatePageActor(tenantId, companyId) {
        const existing = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT * FROM actors
      WHERE tenant_id = $1 AND company_id = $2 AND actor_type = 'page'
      LIMIT 1
      `, [tenantId, companyId]);
        if (existing) {
            return existing;
        }
        // Busca nome da empresa
        const company = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT company_name, trade_name
      FROM companies
      WHERE company_id = $1
      LIMIT 1
      `, [companyId]);
        if (!company) {
            throw new Error('Empresa não encontrada');
        }
        const displayName = company.trade_name || company.company_name;
        const newActor = await (0, pool_1.runQueryWithTenant)(tenantId, `
      INSERT INTO actors (
        tenant_id, actor_type, company_id, display_name, slug
      )
      VALUES ($1, 'page', $2, $3, $4)
      RETURNING *
      `, [tenantId, companyId, displayName, `page-${companyId.substring(0, 8)}`]);
        if (!newActor) {
            throw new Error('Erro ao criar actor');
        }
        return newActor;
    }
    /**
     * Atualiza actor (avatar, cover, bio)
     */
    async update(tenantId, actorId, updates) {
        const fields = [];
        const values = [];
        let paramIndex = 1;
        if (updates.display_name !== undefined) {
            fields.push(`display_name = $${paramIndex++}`);
            values.push(updates.display_name);
        }
        if (updates.avatar_url !== undefined) {
            fields.push(`avatar_url = $${paramIndex++}`);
            values.push(updates.avatar_url);
        }
        if (updates.cover_url !== undefined) {
            fields.push(`cover_url = $${paramIndex++}`);
            values.push(updates.cover_url);
        }
        if (updates.bio !== undefined) {
            fields.push(`bio = $${paramIndex++}`);
            values.push(updates.bio);
        }
        if (updates.metadata !== undefined) {
            fields.push(`metadata = $${paramIndex++}`);
            values.push(JSON.stringify(updates.metadata));
        }
        if (fields.length === 0) {
            return this.findById(tenantId, actorId);
        }
        values.push(actorId);
        const updated = await (0, pool_1.runQueryWithTenant)(tenantId, `
      UPDATE actors
      SET ${fields.join(', ')}
      WHERE actor_id = $${paramIndex}
      RETURNING *
      `, values);
        if (!updated) {
            throw new Error('Actor não encontrado');
        }
        return updated;
    }
}
exports.ActorRepository = ActorRepository;
exports.actorRepository = new ActorRepository();
//# sourceMappingURL=actor.repository.js.map