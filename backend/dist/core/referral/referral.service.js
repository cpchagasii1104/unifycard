"use strict";
// src/core/referral/referral.service.ts
// Serviço de código de indicação/afiliado geral para usuários
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.referralService = void 0;
const pool_1 = require("@core/database/pool");
const crypto_1 = __importDefault(require("crypto"));
class ReferralService {
    /**
     * Gera ou obtém código de indicação do usuário
     */
    async getOrCreateReferralCode(tenantId, userId) {
        // Verificar se já existe código
        const existing = await (0, pool_1.runQueryWithTenant)(tenantId, `
        SELECT referral_code
        FROM users
        WHERE user_id = $1
        LIMIT 1
      `, [userId]);
        if (existing && existing.referral_code) {
            return existing.referral_code;
        }
        // Gerar novo código (8 caracteres alfanuméricos)
        let code = null;
        let attempts = 0;
        const maxAttempts = 10;
        // Garantir que o código é único
        while (!code && attempts < maxAttempts) {
            const candidate = crypto_1.default.randomBytes(4).toString('hex').toUpperCase();
            const check = await (0, pool_1.runQueryWithTenant)(tenantId, `
          SELECT user_id
          FROM users
          WHERE tenant_id = $1 AND referral_code = $2
          LIMIT 1
        `, [tenantId, candidate]);
            if (!check) {
                code = candidate;
            }
            attempts++;
        }
        if (!code) {
            throw new Error('Falha ao gerar código de indicação único');
        }
        // Atualizar usuário com o código
        await (0, pool_1.runQueryWithTenant)(tenantId, `
        UPDATE users
        SET referral_code = $2
        WHERE user_id = $1
      `, [userId, code]);
        return code;
    }
    /**
     * Busca código de indicação do usuário
     */
    async getReferralCode(tenantId, userId) {
        const result = await (0, pool_1.runQueryWithTenant)(tenantId, `
        SELECT referral_code
        FROM users
        WHERE user_id = $1
        LIMIT 1
      `, [userId]);
        return result ? (result.referral_code || null) : null;
    }
    /**
     * Aplica código de indicação (quando novo usuário se registra com código)
     */
    async applyReferralCode(tenantId, newUserId, referralCode) {
        // Buscar usuário que possui o código
        const referrer = await (0, pool_1.runQueryWithTenant)(tenantId, `
        SELECT user_id
        FROM users
        WHERE tenant_id = $1 AND UPPER(referral_code) = UPPER($2)
        LIMIT 1
      `, [tenantId, referralCode]);
        if (!referrer || !referrer.user_id) {
            throw new Error('Código de indicação inválido');
        }
        // Registrar relação de indicação (será usado para calcular comissões futuras)
        // Por enquanto, apenas registramos no metadata do usuário
        await (0, pool_1.runQueryWithTenant)(tenantId, `
        UPDATE users
        SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('referred_by', $2)
        WHERE user_id = $1
      `, [newUserId, referrer.user_id]);
        return { referrerUserId: referrer.user_id };
    }
}
exports.referralService = new ReferralService();
//# sourceMappingURL=referral.service.js.map