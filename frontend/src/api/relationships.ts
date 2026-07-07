// src/api/relationships.ts
// F-ACTOR-RELATIONSHIP-TYPED-EDGE — client da aresta de relação tipada (Fatia 1/2).
// O actor de ORIGEM nunca vai no body (autoridade = actionContext + canRepresentActor server-side,
// DECISION-0113). O body carrega só o RECURSO (toActorId) e a classificação (label governado).

import { apiFetchJson } from './client';

export type RelationshipLabel =
  | 'amigo' | 'conhecido' | 'familiar' | 'cliente' | 'colaborador' | 'fornecedor' | 'parceiro';

export type RelationshipStatus = 'pending' | 'accepted' | 'rejected' | 'removed' | 'blocked';

export interface ActorRelationshipEdge {
  id: string;
  tenantId: string;
  fromActorId: string;
  toActorId: string;
  status: RelationshipStatus;
  requesterLabel: RelationshipLabel;
  targetLabel: RelationshipLabel | null;
  requestedAt: string;
  respondedAt: string | null;
}

/** Enviar pedido de conexão JÁ classificando o outro pela minha ótica. */
export async function sendRelationshipRequest(
  toActorId: string,
  requesterLabel: RelationshipLabel
): Promise<ActorRelationshipEdge> {
  const res = await apiFetchJson<{ ok: boolean; data: ActorRelationshipEdge }>('/relationships', {
    method: 'POST',
    body: JSON.stringify({ toActorId, requesterLabel }),
  });
  return res.data;
}

/** Responder: aceite classificado (targetLabel) ou rejeição. feedPriority opcional no aceite. */
export async function respondRelationship(
  relationshipId: string,
  action: 'accept' | 'reject',
  targetLabel?: RelationshipLabel,
  feedPriority?: string
): Promise<ActorRelationshipEdge> {
  const res = await apiFetchJson<{ ok: boolean; data: ActorRelationshipEdge }>(
    `/relationships/${relationshipId}/respond`,
    { method: 'POST', body: JSON.stringify({ action, targetLabel, feedPriority }) }
  );
  return res.data;
}

/** Minhas conexões (CRM: ?label=fornecedor = "meus fornecedores" pela minha ótica). */
export async function getMyRelationships(filters?: {
  status?: RelationshipStatus;
  label?: RelationshipLabel;
}): Promise<ActorRelationshipEdge[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.label) params.append('label', filters.label);
  const q = params.toString();
  const res = await apiFetchJson<{ ok: boolean; data: ActorRelationshipEdge[] }>(
    `/relationships/mine${q ? `?${q}` : ''}`
  );
  return res.data;
}

// Aceite CLASSIFICADO (achado Clayton 2026-07-07): solicitações RECEBIDAS com os labels PERMITIDOS
// vindos do SERVIDOR (regra de par server-side — a tela só projeta, nunca duplica a regra).
export interface PendingReceivedRequest {
  id: string;
  fromActorId: string;
  fromDisplayName: string;
  fromActorType: string;
  requesterLabel: string;
  requestedAt: string;
  allowedTargetLabels: string[];
}

export async function getPendingReceivedRequests(): Promise<PendingReceivedRequest[]> {
  const body = await apiFetchJson<{ data?: PendingReceivedRequest[] }>('/relationships/pending-received');
  return body.data ?? [];
}

export type FeedPriority = 'padrao' | 'ver_primeiro' | 'ver_mais' | 'ver_menos';

/** Frequência de feed DO MEU LADO da aresta (vocabulário governado; servidor valida tudo). */
export async function patchRelationshipFeedPriority(
  relationshipId: string,
  priority: FeedPriority
): Promise<ActorRelationshipEdge> {
  const res = await apiFetchJson<{ ok: boolean; data: ActorRelationshipEdge }>(
    `/relationships/${relationshipId}/feed-priority`,
    { method: 'PATCH', body: JSON.stringify({ priority }) }
  );
  return res.data;
}

/** Reclassificar O MEU LADO da aresta (ex.: conhecido → amigo). O servidor valida par/participante. */
export async function reclassifyRelationship(
  relationshipId: string,
  label: RelationshipLabel
): Promise<ActorRelationshipEdge> {
  const res = await apiFetchJson<{ ok: boolean; data: ActorRelationshipEdge }>(
    `/relationships/${relationshipId}/label`,
    { method: 'PATCH', body: JSON.stringify({ label }) }
  );
  return res.data;
}
