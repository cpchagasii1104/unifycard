"use strict";
// src/core/referral/referral.service.ts
// Serviço de código de indicação/afiliado geral para usuários
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.referralService = void 0;
const pool_1 = require("@core/database/pool");
const devLog_1 = require("@utils/devLog");
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
     * 🔴 REGRA DE NEGÓCIO: Só pode ser aplicado durante o cadastro, não após
     */
    async applyReferralCode(tenantId, newUserId, referralCode) {
        // 🔴 CRÍTICO: Verificar se usuário já possui referred_by (bloquear reaplicação)
        const userCheck = await (0, pool_1.runQueryWithTenant)(tenantId, `
        SELECT metadata
        FROM users
        WHERE user_id = $1
        LIMIT 1
      `, [newUserId]);
        if (userCheck && userCheck.metadata && userCheck.metadata.referred_by) {
            throw new Error('Código de indicação só pode ser aplicado durante o cadastro');
        }
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
        // Registrar vínculo na tabela user_referral_links (legacy, para backward compatibility)
        try {
            await (0, pool_1.runQueryWithTenant)(tenantId, `
        INSERT INTO user_referral_links (tenant_id, referrer_user_id, referred_user_id, referral_code_used)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (referred_user_id) DO NOTHING
        `, [tenantId, referrer.user_id, newUserId, referralCode]);
        }
        catch (err) {
            // Ignorar erro se tabela não existir (backward compatibility)
        }
        // Registrar na tabela referrals (nova, com expiração)
        try {
            const endsAt = new Date();
            endsAt.setFullYear(endsAt.getFullYear() + 1); // 1 ano a partir de agora
            await (0, pool_1.runQueryWithTenant)(tenantId, `
        INSERT INTO referrals (tenant_id, referrer_user_id, referred_user_id, starts_at, ends_at, percentage_bps, status)
        VALUES ($1, $2, $3, NOW(), $4, 500, 'active')
        ON CONFLICT (tenant_id, referred_user_id) DO NOTHING
        `, [tenantId, referrer.user_id, newUserId, endsAt]);
            devLog_1.devLog.success('referral.created', {
                referrerUserId: referrer.user_id,
                referredUserId: newUserId,
                referralCode,
                endsAt,
            });
        }
        catch (err) {
            devLog_1.devLog.warn('referral.error', {
                error: err instanceof Error ? err.message : String(err),
                referrerUserId: referrer.user_id,
                referredUserId: newUserId,
            });
        }
        return { referrerUserId: referrer.user_id };
    }
}
exports.referralService = new ReferralService();
