// frontend/src/api/evidence.ts
// API client para Evidências & Resolução de Disputas
// 🔴 BLINDAGEM: Apenas leitura, sem cálculos

import { apiFetch, apiFetchJson } from './client';

/**
 * Tipo de contexto do evidence pack
 */
export type EvidenceContextType = 'event' | 'booking' | 'bundle' | 'service_order' | 'agreement';

/**
 * Status de disputa
 */
export type DisputeStatus = 'NONE' | 'OPEN' | 'IN_MEDIATION' | 'RESOLVED';

/**
 * Tipo de evento na timeline
 */
export type EvidenceEventType =
  | 'message_sent'
  | 'agreement_created'
  | 'agreement_updated'
  | 'agreement_proposed'
  | 'agreement_accepted'
  | 'agreement_finalized'
  | 'booking_created'
  | 'booking_decided'
  | 'booking_confirmed'
  | 'service_order_created'
  | 'service_order_confirmed'
  | 'bundle_created'
  | 'bundle_confirmed'
  | 'financial_terms_confirmed'
  | 'bypass_attempted'
  | 'dispute_opened'
  | 'dispute_resolved';

/**
 * Evento na timeline de evidências
 */
export interface EvidenceEvent {
  eventId: string;
  eventType: EvidenceEventType;
  timestamp: string;
  actorId: string;
  userId: string | null;
  data: Record<string, any>;
  source: 'chat' | 'agreement' | 'audit' | 'system';
  sourceId: string | null;
}

/**
 * Evidence Pack
 */
export interface EvidencePack {
  packId: string;
  tenantId: string;
  contextType: EvidenceContextType;
  contextId: string;
  disputeStatus: DisputeStatus;
  openedAt: string | null;
  resolvedAt: string | null;
  retentionUntil: string | null;
  timeline: EvidenceEvent[];
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input para abrir disputa
 */
export interface OpenDisputeInput {
  reason: string;
  openedByActorId: string;
}

/**
 * Input para resolver disputa
 */
export interface ResolveDisputeInput {
  resolution: string;
  resolvedByActorId: string;
}

/**
 * Busca ou cria evidence pack para um contexto
 */
export async function getEvidencePackByContext(
  contextType: string,
  contextId: string
): Promise<EvidencePack> {
  return apiFetchJson<EvidencePack>(`/evidence/context/${contextType}/${contextId}`);
}

/**
 * Busca evidence pack por ID
 */
export async function getEvidencePack(packId: string): Promise<EvidencePack> {
  return apiFetchJson<EvidencePack>(`/evidence/${packId}`);
}

/**
 * Lista evidence packs com filtros
 */
export async function listEvidencePacks(filters: {
  contextType?: EvidenceContextType;
  contextId?: string;
  disputeStatus?: DisputeStatus;
  limit?: number;
  offset?: number;
} = {}): Promise<{ packs: EvidencePack[]; total: number }> {
  const params = new URLSearchParams();
  if (filters.contextType) params.append('contextType', filters.contextType);
  if (filters.contextId) params.append('contextId', filters.contextId);
  if (filters.disputeStatus) params.append('disputeStatus', filters.disputeStatus);
  if (filters.limit) params.append('limit', filters.limit.toString());
  if (filters.offset) params.append('offset', filters.offset.toString());

  const queryString = params.toString();
  return apiFetchJson<{ packs: EvidencePack[]; total: number }>(
    `/evidence${queryString ? `?${queryString}` : ''}`
  );
}

/**
 * Abre disputa
 */
export async function openDispute(packId: string, input: OpenDisputeInput): Promise<EvidencePack> {
  const response = await apiFetch(`/evidence/${packId}/open-dispute`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao abrir disputa' }));
    throw new Error(error.error || 'Erro ao abrir disputa');
  }

  const data = await response.json();
  return data.pack;
}

/**
 * Resolve disputa
 */
export async function resolveDispute(
  packId: string,
  input: ResolveDisputeInput
): Promise<EvidencePack> {
  const response = await apiFetch(`/evidence/${packId}/resolve-dispute`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao resolver disputa' }));
    throw new Error(error.error || 'Erro ao resolver disputa');
  }

  const data = await response.json();
  return data.pack;
}

/**
 * Exporta evidence pack
 */
export async function exportEvidencePack(
  packId: string,
  format: 'json' | 'pdf' = 'json'
): Promise<Blob> {
  const response = await apiFetch(`/evidence/${packId}/export?format=${format}`);

  if (!response.ok) {
    throw new Error('Erro ao exportar evidence pack');
  }

  return response.blob();
}

/**
 * Consolida evidências de um contexto
 */
export async function consolidateEvidence(
  contextType: string,
  contextId: string
): Promise<EvidencePack> {
  const response = await apiFetch(`/evidence/consolidate/${contextType}/${contextId}`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao consolidar evidências' }));
    throw new Error(error.error || 'Erro ao consolidar evidências');
  }

  const data = await response.json();
  return data.pack;
}




