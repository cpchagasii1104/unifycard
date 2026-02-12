"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.actorRepository = exports.ActorRepository = void 0;
// src/modules/social/actor.repository.ts
const pool_1 = require("@core/database/pool");
class ActorRepository {
    /**
     * Busca actor por ID
     */
    /**
     * Busca actor por ID
     *
     * 🔴 GARANTIA CANÔNICA: Cross-tenant leakage prevention
     * - SEMPRE filtra por tenant_id para prevenir vazamento entre tenants
     * - Nenhuma query pode usar apenas actor_id isolado
     */
    async findById(tenantId, actorId) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT actor_id, tenant_id, actor_type, user_id, company_id, group_id,
             display_name, slug, avatar_url, cover_url, bio, metadata,
             createdAt, updatedAt
      FROM actors
      WHERE tenant_id = $1 AND actor_id = $2
      LIMIT 1
      `, [tenantId, actorId]);
        return row || null;
    }
    /**
     * Busca ou cria actor para um usuário
     */
    async findOrCreateUserActor(tenantId, userId) {
        // Primeiro tenta encontrar actor existente
        const existing = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT a.*
      FROM actors a
      WHERE a.tenant_id = $1 
        AND a.user_id = $2
        AND a.actor_type = 'user'
      LIMIT 1
      `, [tenantId, userId]);
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
      `, [tenantId, userId, displayName, `user-${userId.substring(0, 8)}`]);
        if (!newActor) {
            throw new Error('Erro ao criar actor');
        }
        return newActor;
    }
    /**
     * Busca actor por user_id
     */
    async findByUserId(tenantId, userId) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT actor_id, tenant_id, actor_type, user_id, company_id, group_id,
             display_name, slug, avatar_url, cover_url, bio, metadata,
             createdAt, updatedAt
      FROM actors
      WHERE tenant_id = $1 AND user_id = $2 AND actor_type = 'user'
      LIMIT 1
      `, [tenantId, userId]);
        return row || null;
    }
    /**
     * Busca actor por company_id
     */
    async findByCompanyId(tenantId, companyId) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT actor_id, tenant_id, actor_type, user_id, company_id, group_id,
             display_name, slug, avatar_url, cover_url, bio, metadata,
             createdAt, updatedAt
      FROM actors
      WHERE tenant_id = $1 AND company_id = $2 AND actor_type = 'page'
      LIMIT 1
      `, [tenantId, companyId]);
        return row || null;
    }
    /**
     * Atualiza display_name do actor do usuário
     * Idempotente: só atualiza se display_name mudou
     */
    async updateUserActorDisplayName(tenantId, userId, displayName) {
        if (!displayName || displayName.trim() === '') {
            return null; // Não atualizar se displayName vazio
        }
        // Buscar actor do usuário
        const actor = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT a.*
      FROM actors a
      WHERE a.tenant_id = $1 
        AND a.user_id = $2
        AND a.actor_type = 'user'
      LIMIT 1
      `, [tenantId, userId]);
        if (!actor) {
            // Se não existe, criar (usando findOrCreateUserActor)
            return await this.findOrCreateUserActor(tenantId, userId);
        }
        // Se display_name já é o mesmo, não atualizar (idempotente)
        if (actor.display_name === displayName.trim()) {
            return actor;
        }
        // Atualizar display_name
        const updated = await (0, pool_1.runQueryWithTenant)(tenantId, `
      UPDATE actors
      SET display_name = $1, updatedAt = now()
      WHERE actor_id = $2
      RETURNING *
      `, [displayName.trim(), actor.actor_id]);
        return updated || null;
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
     * Busca actors disponíveis para um usuário (pessoal + empresas com permissão)
     * 🔴 BLINDAGEM: can_post é resolvido via verificação real de permissões
     * NÃO pode ser assumido como true automaticamente
     */
    async findAvailableActors(tenantId, userId) {
        // Verificar se o usuário existe no tenant
        const user = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT user_id
      FROM users
      WHERE user_id = $1 AND tenant_id = $2
      LIMIT 1
      `, [userId, tenantId]);
        if (!user) {
            return [];
        }
        const actors = [];
        // 1. Actor pessoal (user)
        // 🔴 REGRA: PF sempre tem can_post = true (permissão básica)
        const userActor = await this.findOrCreateUserActor(tenantId, user.user_id);
        actors.push({
            ...userActor,
            user_role: 'owner',
            can_post: true, // PF sempre pode postar
        });
        // 2. Actors de empresas onde o usuário tem permissão
        // Busca empresas via JOIN direto entre company_users e users usando global_user_id
        const companyActors = await (0, pool_1.runQueriesWithTenant)(tenantId, `
      SELECT 
        a.*,
        cu.role,
        cu.can_manage_company,
        c.company_status
      FROM actors a
      INNER JOIN companies c ON a.company_id = c.company_id
      INNER JOIN company_users cu ON c.company_id = cu.company_id
      INNER JOIN users u ON cu.global_user_id = u.global_user_id
      WHERE a.tenant_id = $1
        AND a.actor_type = 'page'
        AND u.user_id = $2
        AND u.tenant_id = $1
        AND cu.is_active = true
        AND c.status != 'suspended'
      ORDER BY cu.is_primary DESC, c.createdAt DESC
      `, [tenantId, userId]);
        // 🔴 CORREÇÃO CRÍTICA: Resolver can_post via verificação real de permissões
        const { reputationService } = await Promise.resolve().then(() => __importStar(require('./reputation.service')));
        for (const companyActor of companyActors) {
            // Verificar permissões reais do actor
            const permissions = await reputationService.getPermissions(tenantId, companyActor.actor_id, 'page', companyActor.company_status);
            actors.push({
                ...companyActor,
                user_role: companyActor.role,
                can_post: permissions.canPost, // 🔴 VERIFICAÇÃO REAL - não assume true
                company_status: companyActor.company_status,
            });
        }
        return actors;
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
