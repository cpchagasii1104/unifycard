// src/core/referral/referral.service.ts
// Serviço de código de indicação/afiliado geral para usuários

import { runQueryWithTenant } from '@core/database/pool';
import crypto from 'crypto';

class ReferralService {
  /**
   * Gera ou obtém código de indicação do usuário
   */
  async getOrCreateReferralCode(tenantId: string, userId: string): Promise<string> {
    // Verificar se já existe código
    const existing = await runQueryWithTenant<{ referral_code: string | null }>(
      tenantId,
      `
        SELECT referral_code
        FROM users
        WHERE user_id = $1
        LIMIT 1
      `,
      [userId]
    );

    if (existing && existing.referral_code) {
      return existing.referral_code;
    }

    // Gerar novo código (8 caracteres alfanuméricos)
    let code: string | null = null;
    let attempts = 0;
    const maxAttempts = 10;
    
    // Garantir que o código é único
    while (!code && attempts < maxAttempts) {
      const candidate = crypto.randomBytes(4).toString('hex').toUpperCase();
      
      const check = await runQueryWithTenant<{ user_id: string }>(
        tenantId,
        `
          SELECT user_id
          FROM users
          WHERE tenant_id = $1 AND referral_code = $2
          LIMIT 1
        `,
        [tenantId, candidate]
      );
      
      if (!check) {
        code = candidate;
      }
      attempts++;
    }

    if (!code) {
      throw new Error('Falha ao gerar código de indicação único');
    }

    // Atualizar usuário com o código
    await runQueryWithTenant(
      tenantId,
      `
        UPDATE users
        SET referral_code = $2
        WHERE user_id = $1
      `,
      [userId, code]
    );

    return code;
  }

  /**
   * Busca código de indicação do usuário
   */
  async getReferralCode(tenantId: string, userId: string): Promise<string | null> {
    const result = await runQueryWithTenant<{ referral_code: string | null }>(
      tenantId,
      `
        SELECT referral_code
        FROM users
        WHERE user_id = $1
        LIMIT 1
      `,
      [userId]
    );

    return result ? (result.referral_code || null) : null;
  }

  /**
   * Aplica código de indicação (quando novo usuário se registra com código)
   */
  async applyReferralCode(
    tenantId: string,
    newUserId: string,
    referralCode: string
  ): Promise<{ referrerUserId: string }> {
    // Buscar usuário que possui o código
    const referrer = await runQueryWithTenant<{ user_id: string }>(
      tenantId,
      `
        SELECT user_id
        FROM users
        WHERE tenant_id = $1 AND UPPER(referral_code) = UPPER($2)
        LIMIT 1
      `,
      [tenantId, referralCode]
    );

    if (!referrer || !referrer.user_id) {
      throw new Error('Código de indicação inválido');
    }

    // Registrar relação de indicação (será usado para calcular comissões futuras)
    // Por enquanto, apenas registramos no metadata do usuário
    await runQueryWithTenant(
      tenantId,
      `
        UPDATE users
        SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('referred_by', $2)
        WHERE user_id = $1
      `,
      [newUserId, referrer.user_id]
    );

    return { referrerUserId: referrer.user_id };
  }
}

export const referralService = new ReferralService();

