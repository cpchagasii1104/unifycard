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
 * Régua (canal-5-A) — vocabulário CANÔNICO transversal (F-EVENT-AUDIENCE-SSOT-UNIFICATION 2026-07-08;
 * evento deixou de ter plateia paralela public/group/followers/private/unlisted):
 *  - organizer representável (canRepresentActor(event.actor_id)) → vê qualquer visibility/status do PRÓPRIO.
 *  - senão, só status ∈ {published,active}:
 *      public      → qualquer um (inclusive anônimo do tenant);
 *      connections → aresta ACEITA com o organizador; se audience_relationship_types setado, refinado pelo
 *                    LABEL (mesma checagem do modelo transversal — posts/demanda/locação; NÃO regra própria);
 *      only_me     → ninguém além do organizer;
 *      outro       → deny.
 *  (discoverability [listed|unlisted] é OUTRO plano — afeta LISTAGEM/feed, não acesso-por-id; não entra aqui.)
 */
export async function canViewEvent(
  tenantId: string,
  eventId: string,
  callerUserId: string | null | undefined
): Promise<boolean> {
  const rows = await runQueriesWithTenant<{ actor_id: string; status: string; visibility: string; audience_relationship_types: string[] | null }>(
    tenantId,
    `SELECT actor_id, status, visibility, audience_relationship_types FROM events WHERE tenant_id = $1 AND id = $2`,
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
    case 'connections':
      // Aresta ACEITA com o organizador. Se audience_relationship_types setado → refinado pelo LABEL
      // (mesma régua transversal); se NULL/vazio → QUALQUER conexão aceita. Fail-closed sem caller.
      if (!callerUserId) return false;
      if (ev.audience_relationship_types && ev.audience_relationship_types.length > 0) {
        return hasAcceptedRelationshipOfType(tenantId, ev.actor_id, callerUserId, ev.audience_relationship_types);
      }
      return hasAnyAcceptedRelationship(tenantId, ev.actor_id, callerUserId);
    case 'only_me':
      return false; // só organizer (já tratado acima)
    default:
      return false; // deny-first
  }
}

/**
 * DECISION-0161 D3: o viewer (derivado SERVER-SIDE de actors.user_id = caller, mesmo padrão do
 * isFollowerOfOrganizer) tem aresta ACEITA no typed-edge com o organizador, cujo LABEL (de qualquer
 * um dos lados — requester_label OU target_label) esteja entre os tipos exigidos. Fail-closed.
 */
async function hasAcceptedRelationshipOfType(
  tenantId: string,
  organizerActorId: string,
  callerUserId: string,
  requiredTypes: string[]
): Promise<boolean> {
  const rows = await runQueriesWithTenant<{ ok: number }>(
    tenantId,
    `SELECT 1 AS ok
       FROM actor_relationships r
       JOIN actors va ON va.tenant_id = r.tenant_id AND va.user_id = $3
      WHERE r.tenant_id = $1 AND r.status = 'accepted'
        AND ((r.from_actor_id = va.id AND r.to_actor_id = $2) OR (r.from_actor_id = $2 AND r.to_actor_id = va.id))
        AND (r.requester_label = ANY($4::text[]) OR r.target_label = ANY($4::text[]))
      LIMIT 1`,
    [tenantId, organizerActorId, callerUserId, requiredTypes]
  );
  return rows.length > 0;
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

/**
 * QUALQUER conexão aceita entre o organizador e algum actor do caller (derivado SERVER-SIDE de
 * actors.user_id = caller — mesmo padrão do hasAcceptedRelationshipOfType, sem filtro de label).
 * Usado por visibility='connections' sem audience_relationship_types (= todas as conexões). Fail-closed.
 */
async function hasAnyAcceptedRelationship(tenantId: string, organizerActorId: string, callerUserId: string): Promise<boolean> {
  const rows = await runQueriesWithTenant<{ ok: number }>(
    tenantId,
    `SELECT 1 AS ok
       FROM actor_relationships r
       JOIN actors va ON va.tenant_id = r.tenant_id AND va.user_id = $3
      WHERE r.tenant_id = $1 AND r.status = 'accepted'
        AND ((r.from_actor_id = va.id AND r.to_actor_id = $2) OR (r.from_actor_id = $2 AND r.to_actor_id = va.id))
      LIMIT 1`,
    [tenantId, organizerActorId, callerUserId]
  );
  return rows.length > 0;
}
