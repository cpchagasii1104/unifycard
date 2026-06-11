// frontend/src/api/kyb-admin.ts
// CP2 F-PJ-HUMAN-TO-COMPANY (PJ-B2): client do BACKOFFICE MÍNIMO do reviewer KYB.
// Todas as rotas são admin-only no backend (requireRole(['admin'])) — o frontend não decide
// autoridade: um 403 aqui é estado honesto ("acesso restrito a operadores"). O reviewer é
// HUMANO e separado do submitter (founder não acessa; page-actor não revisa — guards no writer).

import { apiFetch } from './client';

export interface KybQueueRow {
  kybRequestId: string;
  fiscalIdentityId: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedByActorId: string;
  reviewedByActorId: string | null;
  reviewedAt: string | null;
  decisionReason: string | null;
  cnpj: string;
  kybStatusCurrent: string;
  companyId: string | null;
  companyName: string | null;
}

export interface KybAdminDocument {
  documentId: string;
  fiscalIdentityId: string;
  documentType: string;
  documentStatus: string;
  decisionReason?: string | null;
  createdAt?: string | null;
  supersedesDocumentId?: string | null;
}

async function jsonOrThrow<T>(response: Response): Promise<T> {
  const json = await response.json().catch(() => ({} as Record<string, unknown>));
  if ((json as { ok?: boolean }).ok === false) {
    throw new Error((json as { message?: string }).message || 'Erro na operação KYB');
  }
  return ((json as { data?: T }).data ?? (json as T)) as T;
}

export async function getKybQueue(status?: string): Promise<KybQueueRow[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return jsonOrThrow<KybQueueRow[]>(await apiFetch(`/identity/pj/kyb/admin/queue${qs}`));
}

export async function getKybDocuments(fiscalIdentityId: string): Promise<KybAdminDocument[]> {
  return jsonOrThrow<KybAdminDocument[]>(
    await apiFetch(`/identity/pj/kyb/fiscal-identities/${fiscalIdentityId}/documents`),
  );
}

/** Download protegido: o backend valida hash, re-escaneia (clean-only) e devolve os bytes. */
export async function downloadKybDocument(documentId: string): Promise<Blob> {
  const response = await apiFetch(`/identity/pj/kyb/documents/${documentId}/file`);
  return response.blob();
}

export async function reviewKybDocument(
  documentId: string,
  decision: 'accepted' | 'rejected',
  reason: string,
): Promise<KybAdminDocument> {
  return jsonOrThrow<KybAdminDocument>(
    await apiFetch(`/identity/pj/kyb/documents/${documentId}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ decision, reason }),
    }),
  );
}

export async function reviewKybRequest(
  requestId: string,
  decision: 'approved' | 'rejected',
  reason: string,
): Promise<{ kybRequestId: string; status: string }> {
  return jsonOrThrow(
    await apiFetch(`/identity/pj/kyb/admin/requests/${requestId}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ decision, reason }),
    }),
  );
}

export async function revokeKybApproval(
  fiscalIdentityId: string,
  newStatus: 'suspended' | 'closed',
  reason: string,
): Promise<{ fiscalIdentityId: string; newStatus: string; retiredPublications: number }> {
  return jsonOrThrow(
    await apiFetch(`/identity/pj/kyb/admin/fiscal-identities/${fiscalIdentityId}/revoke`, {
      method: 'POST',
      body: JSON.stringify({ newStatus, reason }),
    }),
  );
}
