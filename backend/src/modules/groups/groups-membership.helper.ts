// backend/src/modules/groups/groups-membership.helper.ts
// Governança de domínio (grupos): membership/owner — não substitui authority canActAs (§ N3).

/**
 * `owner_user_id` no grupo pode ser `global_user_id` ou user local (legado).
 * Mesma semântica que `groups.service` (updateGroup / removeMember / …).
 */
export function userMatchesGroupOwner(
  ownerUserId: string,
  actorLinkedUserId: string,
  reqUser?: { id?: string; globalUserId?: string }
): boolean {
  if (!ownerUserId) return false;
  if (ownerUserId === actorLinkedUserId) return true;
  if (reqUser?.globalUserId && ownerUserId === reqUser.globalUserId) return true;
  if (reqUser?.id && ownerUserId === reqUser.id) return true;
  return false;
}