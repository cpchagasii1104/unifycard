// backend/src/core/authorization/financial-read-authority.ts
// DECISION-0189 (F3) — AUTORIDADE TERMINAL DE LEITURA FINANCEIRA POR ACTOR.
//
// Responde UMA pergunta com semântica TERMINAL (R5): "este principal pode LER os dados
// financeiros privados deste actor?" — SEM fallback de ownership genérico, role, is_primary,
// can_manage_company, can_manage_financial ou capability de projeção:
//
//   actor user    → SELF apenas (actors.user_id === userId; o recurso prova o dono);
//   actor empresa → membership ATIVA + company_users.can_view_financial = true (subject grant
//                   TERMINAL da tabela normativa §2.3);
//   actor grupo   → FAIL-CLOSED (leitura financeira de grupo não tem substrato promulgado;
//                   comportamento legado já negava — aqui fica explícito);
//   outros        → FAIL-CLOSED.
//
// CONCORRÊNCIA (R13 — modelo promulgado): a decisão e a leitura acontecem com a linha de
// membership (e a linha do actor) travadas FOR SHARE numa transação deste helper. O writer
// de revogação (UPDATE em company_users) FICA BLOQUEADO até o COMMIT desta leitura —
// revogação concorrente espera ou precede LINEARMENTE; nunca há leitura autorizada por
// estado velho pós-revogação commitada. `BEGIN` em READ COMMITTED NÃO é tratado como
// snapshot único — a garantia vem do LOCK, não do isolamento.
//
// AUDITORIA (R18): o caller DEVE registrar o audit event ANTES de responder
// (recordFinancialAudit) — falha de auditoria = 500, nunca disclosure sem rastro.

import { getClientWithTenant } from '@core/database/pool';
import { resolveGlobalUserId } from '@core/identity/identity.utils';

export type FinancialReadRole = 'self' | 'company_view_financial';

export type FinancialReadOutcome<T> =
  | { allowed: true; role: FinancialReadRole; result: T }
  | { allowed: false; reason: string };

/**
 * Autoriza (terminal) e executa a leitura com o lock de membership mantido durante `read`.
 * `read` roda com a autorização LINEARIZADA contra revogações concorrentes.
 * Erros de `read`/infra PROPAGAM (tx aborta; nada de deny fabricado por erro).
 */
export async function authorizeActorFinancialRead<T>(
  tenantId: string,
  userId: string,
  actorId: string,
  read: () => Promise<T>
): Promise<FinancialReadOutcome<T>> {
  if (!tenantId?.trim() || !userId?.trim() || !actorId?.trim()) {
    return { allowed: false, reason: 'invalid_input' };
  }

  const client = await getClientWithTenant(tenantId);
  try {
    await client.query('BEGIN');

    const aRes = await client.query(
      `SELECT actor_type, user_id::text AS user_id, company_id::text AS company_id, group_id::text AS group_id
         FROM actors WHERE tenant_id = $1 AND id = $2 FOR SHARE`,
      [tenantId, actorId]
    );
    const actor = aRes.rows[0] as
      | { actor_type: string; user_id: string | null; company_id: string | null; group_id: string | null }
      | undefined;
    if (!actor) {
      await client.query('ROLLBACK');
      return { allowed: false, reason: 'actor_not_found' };
    }

    let role: FinancialReadRole | null = null;

    if (
      (actor.actor_type === 'user' || actor.actor_type === 'actor_human' || actor.actor_type === 'person') &&
      actor.user_id === userId
    ) {
      role = 'self';
    } else if (actor.company_id) {
      // TERMINAL: membership ativa + can_view_financial. Nada de role/is_primary/manage_*.
      const globalUserId = await resolveGlobalUserId(userId, tenantId, client).catch((e) => {
        if (e instanceof Error && /resolveGlobalUserId|não encontrado|not found/i.test(e.message)) return null; // principal desconhecido = negação legítima (fail-closed); infra propaga
        throw e;
      });
      if (globalUserId) {
        const gRes = await client.query(
          `SELECT can_view_financial FROM company_users
            WHERE tenant_id = $1 AND company_id = $2 AND global_user_id = $3::uuid
              AND member_status = 'active'
            LIMIT 1 FOR SHARE`,
          [tenantId, actor.company_id, globalUserId]
        );
        if ((gRes.rows[0] as { can_view_financial: boolean } | undefined)?.can_view_financial === true) {
          role = 'company_view_financial';
        }
      }
    }
    // grupo/canal/demais: fail-closed (role permanece null)

    if (!role) {
      await client.query('ROLLBACK');
      return { allowed: false, reason: 'no_exact_financial_read_authority' };
    }

    // Leitura com o lock mantido (linearização contra revogação concorrente).
    const result = await read();
    await client.query('COMMIT');
    return { allowed: true, role, result };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { /* noop */ });
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Grant terminal por COMPANY ID (para autorização POR RECURSO quando o recurso resolve
 * direto no dono da conta — ex.: splits). Membership ativa + can_view_financial; sem lock
 * (o caller decide papel/redação por ids já resolvidos server-side).
 */
export async function hasCompanyViewFinancialGrant(
  tenantId: string,
  userId: string,
  companyId: string
): Promise<boolean> {
  const client = await getClientWithTenant(tenantId);
  try {
    const globalUserId = await resolveGlobalUserId(userId, tenantId, client).catch((e) => {
      if (e instanceof Error && /resolveGlobalUserId|não encontrado|not found/i.test(e.message)) return null; // principal desconhecido = negação legítima (fail-closed); infra propaga
      throw e;
    });
    if (!globalUserId) return false;
    const res = await client.query(
      `SELECT can_view_financial FROM company_users
        WHERE tenant_id = $1 AND company_id = $2 AND global_user_id = $3::uuid
          AND member_status = 'active' LIMIT 1`,
      [tenantId, companyId, globalUserId]
    );
    return (res.rows[0] as { can_view_financial: boolean } | undefined)?.can_view_financial === true;
  } finally {
    client.release();
  }
}

/**
 * Variante decisão-apenas (sem leitura acoplada) para superfícies que compõem a resposta
 * fora do lock (usos NÃO-sensíveis a corrida, ex.: gate de contrapartes recentes).
 */
export async function hasActorFinancialReadAuthority(
  tenantId: string,
  userId: string,
  actorId: string
): Promise<{ allowed: boolean; role?: FinancialReadRole; reason?: string }> {
  const out = await authorizeActorFinancialRead(tenantId, userId, actorId, async () => null);
  if (out.allowed) {
    return { allowed: true, role: out.role };
  }
  // tsconfig.build roda com strict:false — narrowing de união discriminada não se aplica.
  return { allowed: false, reason: (out as { reason?: string }).reason };
}
