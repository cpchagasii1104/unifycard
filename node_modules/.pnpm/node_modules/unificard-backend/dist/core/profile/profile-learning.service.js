"use strict";
// src/core/profile/profile-learning.service.ts
// Serviço para gerenciar perfil de aprendizado/trilha
//
// 🔴 BLINDAGEM CANÔNICA: Aprendizado representa direção e interesse declarado
// - NÃO mede capacidade, NÃO valida competência, NÃO bloqueia funcionalidades
// - Progresso (beginner/intermediate/advanced) representa fase de exploração, não nível
// - Por que isso NÃO pode virar decisão: aprendizado é autodireção, não validação
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
exports.profileLearningService = void 0;
const identity_service_1 = require("../identity/identity.service");
class ProfileLearningService {
    /**
     * Busca perfil de aprendizado do usuário
     */
    async getLearningProfile(tenantId, userId) {
        // Buscar globalUserId
        const identity = await identity_service_1.identityService.getIdentityProfile(userId, tenantId);
        if (!identity || !identity.global.globalUserId) {
            return null;
        }
        const globalUserId = identity.global.globalUserId;
        // Buscar aprendizados do usuário (armazenados no metadata do global_user)
        const { pool } = await Promise.resolve().then(() => __importStar(require('@core/database/pool')));
        const userRow = await pool.query(`
      SELECT metadata
      FROM global_users
      WHERE global_user_id = $1
      ORDER BY updated_at DESC
      LIMIT 1
      `, [globalUserId]);
        const metadata = userRow.rows[0]?.metadata || {};
        // Extrair dados do perfil de aprendizado
        const learnings = metadata.learnings || [];
        const preferences = metadata.learningPreferences || {};
        return {
            globalUserId,
            learnings,
            preferences,
            metadata: metadata.learningMetadata || {},
        };
    }
    /**
     * Atualiza perfil de aprendizado
     */
    async updateLearningProfile(tenantId, userId, input) {
        // Buscar globalUserId
        const identity = await identity_service_1.identityService.getIdentityProfile(userId, tenantId);
        if (!identity || !identity.global.globalUserId) {
            throw new Error('Identidade do usuário não encontrada');
        }
        const globalUserId = identity.global.globalUserId;
        // Buscar metadata atual
        const { pool } = await Promise.resolve().then(() => __importStar(require('@core/database/pool')));
        const currentRow = await pool.query(`
      SELECT metadata
      FROM global_users
      WHERE global_user_id = $1
      ORDER BY updated_at DESC
      LIMIT 1
      `, [globalUserId]);
        const currentMetadata = currentRow.rows[0]?.metadata || {};
        // Buscar categorias selecionadas para montar array completo
        let learnings = [];
        if (input.learnings && input.learnings.length > 0) {
            const categoriesResult = await pool.query(`
        SELECT category_id, name, path, level
        FROM categories
        WHERE category_id = ANY($1::uuid[])
          AND scope = 'learning'
          AND (status IS NULL OR status = 'active' OR status = 'auto_active')
        `, [input.learnings]);
            learnings = categoriesResult.rows.map((row) => ({
                categoryId: row.category_id,
                categoryName: row.name,
                categoryPath: row.path,
                level: row.level,
            }));
        }
        // Atualizar metadata com novos dados
        const updatedMetadata = {
            ...currentMetadata,
            learnings,
            learningPreferences: input.preferences || currentMetadata.learningPreferences || {},
            learningMetadata: input.metadata || currentMetadata.learningMetadata || {},
        };
        // Atualizar no banco
        await pool.query(`
      UPDATE global_users
      SET metadata = $1::jsonb, updated_at = now()
      WHERE global_user_id = $2
      `, [JSON.stringify(updatedMetadata), globalUserId]);
        return {
            globalUserId,
            learnings,
            preferences: input.preferences || currentMetadata.learningPreferences || {},
            metadata: input.metadata || currentMetadata.learningMetadata || {},
        };
    }
}
exports.profileLearningService = new ProfileLearningService();
