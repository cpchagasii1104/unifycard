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
 *
 * DECISION-0119: lê a FONTE CANÔNICA `user_referral_links` (vínculo PURO A→B).
 * DECISION-0139: devolve `referrer_actor_id` (owner econômico). Compat: vínculo legado sem actor
 * resolve o actor_human do referrer. Sem owner resolvível, retorna `null` — NÃO inventa dono.
 *
 * 🔴 A JANELA DEIXOU DE SER UMA CONTA ESCRITA AQUI (2026-08-05, GO de Clayton).
 *
 * Até hoje esta função fazia `oneYearAgo.setFullYear(-1)` literal. Para mudar de 1 ano para 6
 * meses, alguém precisaria editar código e republicar o sistema. Clayton: *"isso tem que ser
 * ajustado pelo painel do administrador. Eu preciso ter controle sobre o sistema, não pode ser
 * uma coisa que fique travada."*
 *
 * Agora a janela CHEGA de fora, em dias, vinda de `economic_policy_lines.eligibility_window_days`
 * — a mesma linha onde mora o percentual, que foi exatamente o que ele pediu ("ajusta os dois no
 * mesmo lugar"). Esta função aplica a regra que recebe; ela não escolhe mais nenhuma.
 *
 * ⚠️ OBRIGATÓRIO, sem default: quem chama TEM que decidir. Um default silencioso aqui reintroduz
 * exatamente a doenca — a regra voltaria a morar no codigo, so que escondida numa assinatura.
 * `windowDays = null` significa **SEM PRAZO** — o vínculo vale enquanto a política valer. NÃO
 * significa "usa um ano por padrão": default implícito é como a regra se escondeu no código em
 * primeiro lugar. Quem quer prazo, declara o prazo.
 */
export async function getActiveReferral(
  tenantId: string,
  userId: string,
  atDate: Date,
  windowDays: number | null
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

  // Janela aplicada na LEITURA (política), não materializada no vínculo — isso não mudou.
  // O que mudou é DE ONDE vem o número: era `setFullYear(-1)` aqui dentro; agora é o prazo que o
  // admin configurou na linha da política, em dias.
  if (windowDays !== null) {
    if (!Number.isInteger(windowDays) || windowDays < 1) {
      // Prazo inválido NÃO vira "sem prazo": isso pagaria para sempre por um erro de configuração.
      // Fail-closed — quem configurou errado descobre pelo erro, não pelo extrato.
      throw new Error(
        `REFERRAL_WINDOW_INVALID: janela de elegibilidade precisa ser inteiro >= 1 dia; ` +
        `recebido: ${String(windowDays)}.`
      );
    }
    const referralDate = new Date(link.created_at);
    const limite = new Date(atDate);
    limite.setDate(limite.getDate() - windowDays);
    if (referralDate < limite) {
      // Fora da janela: o vínculo existe, mas não é mais ativo para fins de split.
      return null;
    }
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








