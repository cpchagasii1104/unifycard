// frontend/src/api/inbox.ts
// Inbox social de AÇÕES (read-model). Leitura organizacional — NÃO decide, NÃO executa, NÃO muda domínio.
// Autoridade: o backend exige canRepresentActor(tenant, userId, :id) — o membro lê o inbox da EMPRESA que
// representa (DECISION-0113 F6.5.1 / OWN-PARAMS). NUNCA por grant; NUNCA por localStorage como autoridade.
// O item 'order' nasce automaticamente quando a service_order é confirmada (sourceId = service_order.id).

import { apiFetchJson } from './client';

/** Espelha InboxSourceType backend ('order' = service_order confirmada). */
export type InboxSourceType = 'order' | string;
/** Espelha InboxItemStatus backend. */
export type InboxItemStatus = 'unread' | 'read' | 'archived' | string;

export interface InboxItem {
  inboxItemId: string;
  actorId: string;
  sourceType: InboxSourceType;
  sourceId: string;
  status: InboxItemStatus;
  createdAt: string;
  readAt?: string | null;
  archivedAt?: string | null;
  metadata: Record<string, any>;
}

/**
 * Lista os itens de inbox de um actor (o membro precisa REPRESENTAR :actorId — gate no backend).
 * GET /inbox/actors/:id?sourceType=&status= → { ok, data: InboxItem[] }.
 */
export async function getActorInbox(
  actorId: string,
  filters?: { sourceType?: InboxSourceType; status?: InboxItemStatus }
): Promise<InboxItem[]> {
  const params = new URLSearchParams();
  if (filters?.sourceType) params.append('sourceType', filters.sourceType);
  if (filters?.status) params.append('status', filters.status);
  const query = params.toString();
  const res = await apiFetchJson<{ ok: boolean; data: InboxItem[] }>(
    `/inbox/actors/${actorId}${query ? `?${query}` : ''}`
  );
  return res?.ok && Array.isArray(res.data) ? res.data : [];
}

/** Atalho: itens de ORDER (service_order confirmada) — fonte do "operador vê a ordem nascida". */
export async function getOrderInbox(actorId: string): Promise<InboxItem[]> {
  return getActorInbox(actorId, { sourceType: 'order' });
}
