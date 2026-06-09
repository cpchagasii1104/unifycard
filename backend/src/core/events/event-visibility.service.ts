// backend/src/core/events/event-visibility.service.ts
// 🔵 DECISION-0113 F6.5.6b-CANAL5-A — canViewEvent: helper ÚNICO de visibilidade para ACESSO POR ID.
// Espelha a régua da discovery (B1–B4). Eixo de autoridade = event.actor_id (NÃO created_by_*; NÃO é gate de
// gestão como requireEventOwnerOrAdmin). Read-only. Mora no core para que tanto core/events quanto
// modules/events possam importar sem violar a camada (modules→core OK; core→modules NÃO).

import { runQueriesWithTenant } from '@core/database/pool';
import { authorizationService } from '@core/authorization/authorization.service';

// Piso de status para quem NÃO representa o organizer (Clayton: 'declared' fora; só published/active abrem por id).
const PUBLISHABLE = new Set(['published', 'active']);

/**
 * Decide se o caller pode VER o evento por ID. Lê os campos RAW (status/visibility/actor_id) — NÃO depende do
 * mapeamento do Event (que colapsa published/active/declared em 'PUBLISHED'). Deny-first: qualquer caso fora das
 * regras → false (a rota responde 404 não-leak, sem confirmar existência).
 *
 * Régua (canal-5-A):
 *  - organizer representável (canRepresentActor(event.actor_id)) → vê qualquer visibility/status do PRÓPRIO.
 *  - senão, só status ∈ {published,active}:
 *      public    → qualquer autenticado do tenant;
 *      unlisted  → qualquer autenticado do tenant (acesso por link/id; não aparece em listagem);
 *      group     → membro material (group_members.user_id = caller, via actors.group_id — mesmo eixo do B3);
 *      followers → follower material (follows; follower deriva de actors.user_id = caller — server-side, B4);
 *      private   → ninguém além do organizer;
 *      outro     → deny.
 */
export async function canViewEvent(
  tenantId: string,
  eventId: string,
  callerUserId: string | null | undefined
): Promise<boolean> {
  const rows = await runQueriesWithTenant<{ actor_id: string; status: string; visibility: string }>(
    tenantId,
    `SELECT actor_id, status, visibility FROM events WHERE tenant_id = $1 AND id = $2`,
    [tenantId, eventId]
  );
  const ev = rows[0];
  if (!ev) return false; // inexistente → 404 indistinguível

  // organizer representável vê qualquer coisa do PRÓPRIO (eixo actor_id, não created_by_*).
  if (callerUserId) {
    let represents = false;
    try {
      represents = await authorizationService.canRepresentActor(tenantId, callerUserId, ev.actor_id);
    } catch {
      represents = false;
    }
    if (represents) return true;
  }

  if (!PUBLISHABLE.has(ev.status)) return false; // draft/declared/ended/cancelled → só organizer (tratado acima)

  switch (ev.visibility) {
    case 'public':
      return true;
    case 'unlisted':
      return !!callerUserId; // acessível por link/id ao autenticado do tenant
    case 'group':
      return callerUserId ? isGroupMember(tenantId, ev.actor_id, callerUserId) : false;
    case 'followers':
      return callerUserId ? isFollowerOfOrganizer(tenantId, ev.actor_id, callerUserId) : false;
    case 'private':
      return false; // só organizer (já tratado)
    default:
      return false; // deny-first
  }
}

// membership material: event.actor_id (group-actor) → actors.group_id → group_members.user_id = caller. (eixo B3)
async function isGroupMember(tenantId: string, organizerActorId: string, callerUserId: string): Promise<boolean> {
  const rows = await runQueriesWithTenant<{ ok: number }>(
    tenantId,
    `SELECT 1 AS ok FROM actors a
       JOIN group_members gm ON gm.group_id = a.group_id AND gm.tenant_id = a.tenant_id AND gm.user_id = $3
     WHERE a.tenant_id = $1 AND a.id = $2 AND a.group_id IS NOT NULL
     LIMIT 1`,
    [tenantId, organizerActorId, callerUserId]
  );
  return rows.length > 0;
}

// follow material: algum actor do caller (actors.user_id = caller, server-side) segue o organizer. (eixo B4)
async function isFollowerOfOrganizer(tenantId: string, organizerActorId: string, callerUserId: string): Promise<boolean> {
  const rows = await runQueriesWithTenant<{ ok: number }>(
    tenantId,
    `SELECT 1 AS ok FROM follows f
       JOIN actors fa ON fa.id = f.follower_actor_id AND fa.tenant_id = f.tenant_id AND fa.user_id = $3
     WHERE f.tenant_id = $1 AND f.followed_actor_id = $2
     LIMIT 1`,
    [tenantId, organizerActorId, callerUserId]
  );
  return rows.length > 0;
}
