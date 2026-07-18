/**
 * ⚠️ LEGADO PRÉ-GATE-0 — CONGELADO
 *
 * Este arquivo contém lógica histórica anterior ao fechamento do Gate 0.
 *
 * Após o Gate 0:
 * - users.global_user_id é a ÚNICA fonte de verdade para identidade global.
 * - user_identity_links NÃO é autoridade.
 * - resolveGlobalUserId NÃO deve ser usado como referência.
 *
 * Este arquivo:
 * - NÃO deve ser refatorado
 * - NÃO deve ser usado como modelo
 * - NÃO deve ser expandido
 *
 * Qualquer alteração só é permitida após abertura formal do Gate 1.
 */

// src/core/identity/identity.utils.ts
import { pool } from '@core/database/pool';
import { runQueryWithTenant } from '@core/database/pool';

/**
 * Resolve global_user_id a partir de user_id local
 * Tenta primeiro users.global_user_id, depois user_identity_links
 * 
 * 🔴 REGRA CRÍTICA: NUNCA retorna null - sempre lança erro se não encontrar
 * Isso previne criação silenciosa de múltiplos global_users
 */
export async function resolveGlobalUserId(
  userId: string,
  tenantId?: string,
  existingClient?: { query(text: string, params?: unknown[]): Promise<{ rows: unknown[] }> }
): Promise<string> {
  if (!userId) {
    throw new Error('userId é obrigatório para resolveGlobalUserId');
  }

  let resolvedGlobalUserId: string | null = null;

  // 🔒 TRANSACTION-AWARE (remediação D9.1): com `existingClient`, a MESMA consulta canônica roda no
  // client do caller com a linha de users lida FOR SHARE (evidência de identidade do principal
  // serializada contra mutação concorrente). Sem client, caminhos pool byte-idênticos.
  if (existingClient) {
    const res = await existingClient.query(
      `SELECT global_user_id FROM users WHERE id = $1 LIMIT 1 FOR SHARE`,
      [userId]
    );
    const gu = (res.rows[0] as { global_user_id: string | null } | undefined)?.global_user_id;
    if (gu) {
      resolvedGlobalUserId = gu;
    }
  } else
  // 🔴 GARANTIA CANÔNICA: users.global_user_id é a fonte única de verdade
  // Se tenantId fornecido, usar RLS
  if (tenantId) {
    const user = await runQueryWithTenant<{ global_user_id: string | null }>(
      tenantId,
      `
        SELECT global_user_id
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [userId]
    );

    if (user?.global_user_id) {
      resolvedGlobalUserId = user.global_user_id;
    }
  } else {
    // Sem tenantId, buscar direto em users (sistema)
    const user = await pool.query<{ global_user_id: string | null }>(
      `
        SELECT global_user_id
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [userId]
    );

    if (user.rows[0]?.global_user_id) {
      resolvedGlobalUserId = user.rows[0].global_user_id;
    }
  }

  // 🔴 REGRA CRÍTICA: Se não encontrou, lançar erro explícito
  if (!resolvedGlobalUserId) {
    console.error('[IdentityService] ❌ ERRO CRÍTICO: Global user não encontrado para user_id', userId, {
      tenantId,
      message: 'Não foi possível resolver global_user_id. Possível dessincronização ou usuário sem identidade global.',
      hint: 'Execute DIAGNOSTICO_MULTIPLOS_GLOBAL_USERS.sql para investigar',
    });
    throw new Error(`Global user não encontrado para user_id: ${userId}${tenantId ? ` (tenant: ${tenantId})` : ''}. Execute diagnóstico SQL para investigar múltiplos global_users.`);
  }

  return resolvedGlobalUserId;
}















