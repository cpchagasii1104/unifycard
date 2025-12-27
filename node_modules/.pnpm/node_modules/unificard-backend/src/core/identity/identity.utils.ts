// src/core/identity/identity.utils.ts
import { pool } from '@core/database/pool';
import { runQueryWithTenant } from '@core/database/pool';

/**
 * Resolve global_user_id a partir de user_id local
 * Tenta primeiro users.global_user_id, depois user_identity_links
 */
export async function resolveGlobalUserId(
  userId: string,
  tenantId?: string
): Promise<string | null> {
  // Se tenantId fornecido, usar RLS
  if (tenantId) {
    const user = await runQueryWithTenant<{ global_user_id: string | null }>(
      tenantId,
      `
        SELECT global_user_id
        FROM users
        WHERE user_id = $1
        LIMIT 1
      `,
      [userId]
    );

    if (user?.global_user_id) {
      return user.global_user_id;
    }

    // Tentar via user_identity_links
    // 🔴 CORREÇÃO: ORDER BY para garantir link mais recente
    const link = await pool.query<{ global_user_id: string }>(
      `
        SELECT global_user_id
        FROM user_identity_links
        WHERE user_id = $1 AND tenant_id = $2
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [userId, tenantId]
    );

    if (link.rows[0]?.global_user_id) {
      return link.rows[0].global_user_id;
    }
  } else {
    // Sem tenantId, buscar direto em users (sistema)
    const user = await pool.query<{ global_user_id: string | null }>(
      `
        SELECT global_user_id
        FROM users
        WHERE user_id = $1
        LIMIT 1
      `,
      [userId]
    );

    if (user.rows[0]?.global_user_id) {
      return user.rows[0].global_user_id;
    }

    // Tentar via user_identity_links (qualquer tenant)
    // 🔴 CORREÇÃO: ORDER BY para garantir link mais recente
    const link = await pool.query<{ global_user_id: string }>(
      `
        SELECT global_user_id
        FROM user_identity_links
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [userId]
    );

    if (link.rows[0]?.global_user_id) {
      return link.rows[0].global_user_id;
    }
  }

  return null;
}








