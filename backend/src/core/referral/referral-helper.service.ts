// backend/src/core/referral/referral-helper.service.ts
// CONTINUOUS PRODUCTION: Helper para lógica de referral no Split Engine

import { runQueryWithTenant } from '@core/database/pool';

/**
 * Busca referrer ATIVO para um usuário indicado.
 * Retorna referrerUserId APENAS se o vínculo existe e está dentro da janela de
 * 1 ano; retorna null caso contrário.
 *
 * DECISION-0119: lê a FONTE CANÔNICA `user_referral_links` (vínculo PURO A→B). A
 * janela de 1 ano é REGRA DE LEITURA/POLÍTICA aplicada aqui — NÃO é coluna da
 * tabela de vínculo (que não guarda janela/expiração/status). O ramo legado da
 * tabela `referrals` (arquivada/incompatível, ausente no schema vivo) foi
 * neutralizado: o split-engine passa a ler o vínculo puro por esta função.
 */
export async function getActiveReferral(
  tenantId: string,
  userId: string,
  atDate: Date = new Date()
): Promise<string | null> {
  let link: { referrer_user_id: string; created_at: Date } | null = null;
  try {
    link = (await runQueryWithTenant<{
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
    // Tabela ausente (ambiente sem a migration) — sem referral.
    return null;
  }

  if (!link) {
    return null;
  }

  // Janela de 1 ano aplicada na LEITURA (política), não materializada no vínculo.
  const referralDate = new Date(link.created_at);
  const oneYearAgo = new Date(atDate);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  if (referralDate >= oneYearAgo) {
    return link.referrer_user_id;
  }

  // Após 1 ano, o vínculo não é mais ativo para fins de split.
  return null;
}








