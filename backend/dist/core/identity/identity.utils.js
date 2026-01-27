"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveGlobalUserId = resolveGlobalUserId;
// src/core/identity/identity.utils.ts
const pool_1 = require("@core/database/pool");
const pool_2 = require("@core/database/pool");
/**
 * Resolve global_user_id a partir de user_id local
 * Tenta primeiro users.global_user_id, depois user_identity_links
 *
 * 🔴 REGRA CRÍTICA: NUNCA retorna null - sempre lança erro se não encontrar
 * Isso previne criação silenciosa de múltiplos global_users
 */
async function resolveGlobalUserId(userId, tenantId) {
    if (!userId) {
        throw new Error('userId é obrigatório para resolveGlobalUserId');
    }
    let resolvedGlobalUserId = null;
    // Se tenantId fornecido, usar RLS
    if (tenantId) {
        const user = await (0, pool_2.runQueryWithTenant)(tenantId, `
        SELECT global_user_id
        FROM users
        WHERE user_id = $1
        LIMIT 1
      `, [userId]);
        if (user?.global_user_id) {
            resolvedGlobalUserId = user.global_user_id;
        }
        else {
            // Tentar via user_identity_links
            const link = await pool_1.pool.query(`
          SELECT global_user_id
          FROM user_identity_links
          WHERE user_id = $1 AND tenant_id = $2
          ORDER BY created_at DESC
          LIMIT 1
        `, [userId, tenantId]);
            if (link.rows[0]?.global_user_id) {
                resolvedGlobalUserId = link.rows[0].global_user_id;
            }
        }
    }
    else {
        // Sem tenantId, buscar direto em users (sistema)
        const user = await pool_1.pool.query(`
        SELECT global_user_id
        FROM users
        WHERE user_id = $1
        LIMIT 1
      `, [userId]);
        if (user.rows[0]?.global_user_id) {
            resolvedGlobalUserId = user.rows[0].global_user_id;
        }
        else {
            // Tentar via user_identity_links (qualquer tenant)
            const link = await pool_1.pool.query(`
          SELECT global_user_id
          FROM user_identity_links
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT 1
        `, [userId]);
            if (link.rows[0]?.global_user_id) {
                resolvedGlobalUserId = link.rows[0].global_user_id;
            }
        }
    }
    // 🔴 REGRA CRÍTICA: Se não encontrou, lançar erro explícito
    if (!resolvedGlobalUserId) {
        console.error('[IdentityService] ❌ ERRO CRÍTICO: Global user não encontrado para user_id', userId, {
            tenantId,
            message: 'Não foi possível resolver global_user_id. Possível dessincronização ou usuário sem identidade global.',
            hint: 'Execute DIAGNOSTICO_MULTIPLOS_GLOBAL_USERS.sql para investigar',
        });
        throw new Error(`Global user não encontrado para user_id: ${userId}${tenantId ? ` (tenant: ${tenantId})` : ''}. Execute diagnóstico SQL para investigar múltiplos global_users.`);
    }
    return resolvedGlobalUserId;
}
