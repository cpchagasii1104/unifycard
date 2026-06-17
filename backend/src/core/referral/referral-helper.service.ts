// backend/src/core/referral/referral-helper.service.ts
// CONTINUOUS PRODUCTION: Helper para lógica de referral no Split Engine

import { runQueryWithTenant } from '@core/database/pool';

/**
 * Resultado da resolução de referral ATIVO. DECISION-0139: o DONO ECONÔMICO do
 * vínculo é o ACTOR (referrerActorId = owner_actor_id do código usado), NÃO o CPF/user
 * por reflexo. referrerUserId é breadcrumb civil (pode ser null em vínculos futuros).
 */
export interface ActiveReferral {
  /** Owner econômico — destino de earnings (actor_wallet deste actor). */
  referrerActorId: string;
  /** Breadcrumb civil do referrer (compat); NÃO é dono econômico. */
  referrerUserId: string | null;
}

/**
 * Busca referral ATIVO para um usuário indicado e resolve o OWNER ECONÔMICO (actor).
 * Retorna o owner actor APENAS se o vínculo existe e está dentro da janela de 1 ano.
 *
 * DECISION-0119: lê a FONTE CANÔNICA `user_referral_links` (vínculo PURO A→B); a janela
 * de 1 ano é REGRA DE LEITURA (não coluna). DECISION-0139: devolve referrer_actor_id
 * (owner econômico). Compat: vínculo legado sem actor resolve o actor_human do referrer.
 * Se não houver owner actor resolvível, retorna null (NÃO inventa dono).
 */
export async function getActiveReferral(
  tenantId: string,
  userId: string,
  atDate: Date = new Date()
): Promise<ActiveReferral | null> {
  let link: { referrer_actor_id: string | null; referrer_user_id: string; created_at: Date } | null = null;
  try {
    link = (await runQueryWithTenant<{
      referrer_actor_id: string | null;
      referrer_user_id: string;
      created_at: Date;
    }>(
      tenantId,
      `
        SELECT referrer_actor_id, referrer_user_id, created_at
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
  if (referralDate < oneYearAgo) {
    // Após 1 ano, o vínculo não é mais ativo para fins de split.
    return null;
  }

  // DECISION-0139: owner econômico = referrer_actor_id. Compat: vínculo legado sem
  // actor resolve o actor_human do referrer (NUNCA paga o user "por reflexo" sem actor).
  let referrerActorId = link.referrer_actor_id;
  if (!referrerActorId) {
    const a = await runQueryWithTenant<{ id: string }>(
      tenantId,
      `SELECT id FROM actors
        WHERE tenant_id = $1 AND user_id = $2 AND actor_type IN ('user', 'person', 'actor_human')
        LIMIT 1`,
      [tenantId, link.referrer_user_id]
    );
    referrerActorId = a?.id ?? null;
  }

  if (!referrerActorId) {
    // Sem owner econômico resolvível ⇒ sem split de referral (não inventa dono).
    return null;
  }

  return { referrerActorId, referrerUserId: link.referrer_user_id };
}








