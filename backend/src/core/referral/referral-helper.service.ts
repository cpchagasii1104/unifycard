// backend/src/core/referral/referral-helper.service.ts
// CONTINUOUS PRODUCTION: Helper para lógica de referral no Split Engine

import { runQueryWithTenant } from '@core/database/pool';

/**
 * Busca referrer ativo para um usuário
 * Retorna referrerUserId APENAS se referral está ativo e não expirado
 * Retorna null caso contrário
 * 
 * Usa tabela referrals (nova) se disponível, senão usa user_referral_links (legacy)
 */
export async function getActiveReferral(
  tenantId: string,
  userId: string,
  atDate: Date = new Date()
): Promise<string | null> {
  // Tentar buscar da tabela referrals (nova)
  const referralResult = await runQueryWithTenant<{
    referrer_user_id: string;
    ends_at: Date;
    status: string;
  }>(
    tenantId,
    `
      SELECT referrer_user_id, ends_at, status
      FROM referrals
      WHERE tenant_id = $1 
        AND referred_user_id = $2 
        AND status = 'active'
        AND ends_at > $3
      LIMIT 1
    `,
    [tenantId, userId, atDate]
  );

  if (referralResult && referralResult.length > 0) {
    return referralResult[0].referrer_user_id;
  }

  // Fallback: usar user_referral_links (legacy) para backward compatibility
  const legacyResult = await runQueryWithTenant<{
    referrer_user_id: string;
    created_at: Date;
  }>(
    tenantId,
    `
      SELECT referrer_user_id, created_at
      FROM user_referral_links
      WHERE tenant_id = $1 AND referred_user_id = $2
      LIMIT 1
    `,
    [tenantId, userId]
  );

  if (!legacyResult || legacyResult.length === 0) {
    return null;
  }

  const link = legacyResult[0];
  const referralDate = new Date(link.created_at);
  const oneYearAgo = new Date(atDate);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  // Se referral tem menos de 1 ano, retornar referrer
  if (referralDate >= oneYearAgo) {
    return link.referrer_user_id;
  }

  // Após 1 ano, referral não é mais ativo
  return null;
}







