/**
 * Resolução canónica de identidade operacional (actors / vínculo user ↔ global_user).
 * Qualquer outro módulo deve usar estes métodos em vez de SQL direto a `actors` / `users` para os mesmos fins.
 *
 * O perfil global e políticas largas continuam em `@core/identity/identity.service` (legado Gate 0).
 */
import { runQueryWithTenant } from '@core/database/pool';
import { bankAccountRepository } from '@modules/bank/bank-account.repository';

/** Verifica se existe linha em `actors` para o UUID canónico no tenant. */
export async function isActorIdInTenant(
  tenantId: string,
  actorId: string
): Promise<boolean> {
  const row = await runQueryWithTenant<{ one: number }>(
    tenantId,
    `SELECT 1 AS one FROM actors WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [actorId, tenantId]
  );
  return !!row;
}

/**
 * Resolve `users.user_id` no tenant a partir de `global_user_id` (coluna em `users`).
 */
export async function getLocalUserIdByGlobalUserId(
  tenantId: string,
  globalUserId: string
): Promise<string | null> {
  const row = await runQueryWithTenant<{ user_id: string }>(
    tenantId,
    `
    SELECT user_id FROM users
    WHERE global_user_id = $1 AND tenant_id = $2
    LIMIT 1
    `,
    [globalUserId, tenantId]
  );
  return row?.user_id ?? null;
}

/**
 * Dono de wallet / candidato UUID → actor canónico: primeiro conta Bank (owner actor), depois PK em `actors`.
 */
export async function resolveActorIdForWalletOwner(
  tenantId: string,
  ownerId: string
): Promise<string | null> {
  const actorFromBank = await bankAccountRepository.findActorIdForActorOwnedAccount(
    tenantId,
    ownerId
  );
  if (actorFromBank) return actorFromBank;

  const row = await runQueryWithTenant<{ id: string }>(
    tenantId,
    `SELECT id::text FROM actors WHERE tenant_id = $1 AND id = $2::uuid LIMIT 1`,
    [tenantId, ownerId]
  );
  return row?.id ?? null;
}