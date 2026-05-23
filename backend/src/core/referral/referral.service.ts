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
        WHERE id = $1
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
      
      const check = await runQueryWithTenant<{ id: string }>(
        tenantId,
        `
          SELECT id
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
        WHERE id = $1
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
        WHERE id = $1
        LIMIT 1
      `,
      [userId]
    );

    return result ? (result.referral_code || null) : null;
  }

  /**
   * Aplica código de indicação (quando novo usuário se registra com código)
   * 🔴 REGRA DE NEGÓCIO: Só pode ser aplicado durante o cadastro, não após
   */
  async applyReferralCode(
    tenantId: string,
    newUserId: string,
    referralCode: string
  ): Promise<{ referrerUserId: string }> {
    // 🔴 CRÍTICO: Verificar se usuário já possui referred_by (bloquear reaplicação)
    const userCheck = await runQueryWithTenant<{ metadata: any }>(
      tenantId,
      `
        SELECT metadata
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [newUserId]
    );

    if (userCheck && userCheck.metadata && userCheck.metadata.referred_by) {
      throw new Error('Código de indicação só pode ser aplicado durante o cadastro');
    }

    // Buscar usuário que possui o código
    const referrer = await runQueryWithTenant<{ id: string }>(
      tenantId,
      `
        SELECT id
        FROM users
        WHERE tenant_id = $1 AND UPPER(referral_code) = UPPER($2)
        LIMIT 1
      `,
      [tenantId, referralCode]
    );

    if (!referrer || !referrer.id) {
      throw new Error('Código de indicação inválido');
    }

    // Registrar relação de indicação (será usado para calcular comissões futuras)
    // Por enquanto, apenas registramos no metadata do usuário
    await runQueryWithTenant(
      tenantId,
      `
        UPDATE users
        SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('referred_by', $2)
        WHERE id = $1
      `,
      [newUserId, referrer.id]
    );

    // 🔴 GARANTIA CANÔNICA: Inserção canônica conforme schema
    // 1) Inserir primeiro em user_referral_links com RETURNING link_id
    // 2) Inserir em referrals INCLUINDO link_id (NOT NULL)
    let linkId: string | null = null;
    try {
      const linkResult = await runQueryWithTenant<{ link_id: string }>(
        tenantId,
        `
        INSERT INTO user_referral_links (tenant_id, referrer_user_id, referred_user_id, referral_code_used)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (tenant_id, referred_user_id) DO NOTHING
        RETURNING link_id
        `,
        [tenantId, referrer.id, newUserId, referralCode]
      );
      
      if (linkResult?.link_id) {
        linkId = linkResult.link_id;
      } else {
        // ON CONFLICT DO NOTHING não retorna linha, buscar link_id existente
        const existingLink = await runQueryWithTenant<{ link_id: string }>(
          tenantId,
          `
          SELECT link_id
          FROM user_referral_links
          WHERE tenant_id = $1 AND referred_user_id = $2
          LIMIT 1
          `,
          [tenantId, newUserId]
        );
        
        if (existingLink?.link_id) {
          linkId = existingLink.link_id;
        }
      }
    } catch (err) {
      // Se user_referral_links NÃO EXISTIR, PARAR e REPORTAR
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('does not exist') || errorMessage.includes('relation') || errorMessage.includes('table')) {
        throw new Error(`Tabela user_referral_links não existe. Execute migration 030_referrals.sql primeiro.`);
      }
      // Outros erros podem ser ignorados (ex: constraint violation)
      console.warn('[referral.service] referral.link_error', {
        error: errorMessage,
      });
    }

    // Registrar na tabela referrals (nova, com expiração)
    // 🔴 CRÍTICO: Incluir link_id se disponível (NOT NULL conforme schema)
    try {
      const endsAt = new Date();
      endsAt.setFullYear(endsAt.getFullYear() + 1); // 1 ano a partir de agora

      if (linkId) {
        await runQueryWithTenant(
          tenantId,
          `
          INSERT INTO referrals (tenant_id, link_id, referrer_user_id, referred_user_id, startsAt, endsAt, percentage_bps, status)
          VALUES ($1, $2, $3, $4, NOW(), $5, 500, 'active')
          ON CONFLICT (tenant_id, referred_user_id) DO NOTHING
          `,
          [tenantId, linkId, referrer.id, newUserId, endsAt]
        );
      } else {
        // Se não tem link_id, tentar inserir sem ele (pode falhar se constraint exigir)
        await runQueryWithTenant(
          tenantId,
          `
          INSERT INTO referrals (tenant_id, referrer_user_id, referred_user_id, startsAt, endsAt, percentage_bps, status)
          VALUES ($1, $2, $3, NOW(), $4, 500, 'active')
          ON CONFLICT (tenant_id, referred_user_id) DO NOTHING
          `,
          [tenantId, referrer.id, newUserId, endsAt]
        );
      }
      
      console.log('[referral.service] referral.created', {
        referrerUserId: referrer.id,
        referredUserId: newUserId,
        referralCode,
        linkId,
        endsAt,
      });
    } catch (err) {
      console.warn('[referral.service] referral.error', {
        error: err instanceof Error ? err.message : String(err),
        referrerUserId: referrer.id,
        referredUserId: newUserId,
        linkId,
      });
    }

    return { referrerUserId: referrer.id };
  }
}

export const referralService = new ReferralService();


