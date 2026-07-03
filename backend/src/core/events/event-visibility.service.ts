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

/**
 * 🔵 DECISION-0113 F6.5.6b-EVENTS-MONEY-READS — autoridade de READ de dado FINANCEIRO/procurement de evento
 * (settlement, RFQ). Camada DUPLA (decisão Clayton):
 *   - 404 não-leak: evento inexistente OU não visível pelo `canViewEvent` (não confirma evento privado);
 *   - 403 forbidden: evento VISÍVEL, mas o caller não REPRESENTA o organizer (`event.actor_id`).
 * Money NÃO pega carona em visibility: `canViewEvent` só serve para o 404; a autoridade financeira é
 * `canRepresentActor(event.actor_id)` (MVP organizer-only; finance-admin/view_all_ledger = decisão futura).
 */
export async function assertCanReadEventMoney(
  tenantId: string,
  eventId: string,
  callerUserId: string | null | undefined
  // status?: never no braço ok:true — fix do achado B4 do auditoria.md (narrowing de união
  // discriminada quebrado sob strict:false do tsconfig.build/gate). Zero mudança de runtime.
): Promise<{ ok: true; status?: never } | { ok: false; status: 404 | 403 }> {
  // camada 404: inexistente ou invisível pelo modelo de visibility (não-leak de existência).
  if (!(await canViewEvent(tenantId, eventId, callerUserId))) return { ok: false, status: 404 };
  // camada 403: visível, mas dado financeiro exige REPRESENTAR o organizer (event.actor_id) — não canViewEvent.
  const rows = await runQueriesWithTenant<{ actor_id: string | null }>(
    tenantId,
    `SELECT actor_id::text AS actor_id FROM events WHERE tenant_id = $1 AND id = $2`,
    [tenantId, eventId]
  );
  const organizerActorId = rows[0]?.actor_id;
  if (!organizerActorId || !callerUserId) return { ok: false, status: 403 }; // sem organizer/user → fail-closed
  let canRep = false;
  try {
    canRep = await authorizationService.canRepresentActor(tenantId, callerUserId, organizerActorId);
  } catch {
    canRep = false;
  }
  return canRep ? { ok: true } : { ok: false, status: 403 };
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
