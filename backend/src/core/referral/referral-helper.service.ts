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
  // Tentar buscar da tabela referrals (nova) — try/catch tolera tabela ausente
  // para permitir fallback ao legacy + retorno null quando referral não existe (smoke v3 fundacional).
  try {
    const referralResult = await runQueryWithTenant<{
      referrer_user_id: string;
      endsAt: Date;
      status: string;
    }>(
      tenantId,
      `
        SELECT referrer_user_id, endsAt, status
        FROM referrals
        WHERE tenant_id = $1
          AND referred_user_id = $2
          AND status = 'active'
          AND endsAt > $3
        LIMIT 1
      `,
      [tenantId, userId, atDate]
    );

    if (referralResult) {
      return referralResult.referrer_user_id;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/relação .* não existe|relation .* does not exist/i.test(msg)) {
      throw err;
    }
    // Tabela ausente — segue para legacy
  }

  // Fallback: usar user_referral_links (legacy) para backward compatibility
  let legacyResult: { referrer_user_id: string; created_at: Date } | null = null;
  try {
    legacyResult = (await runQueryWithTenant<{
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
    )) ?? null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/relação .* não existe|relation .* does not exist/i.test(msg)) {
      throw err;
    }
    // Tabela legacy também ausente — sem referral
    return null;
  }

  if (!legacyResult) {
    return null;
  }

  const link = legacyResult;
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








