// src/api/support-tickets.ts
// F-SUPPORT-TICKET-BUSINESS-FACT-GATE (Fatia 6) — client do "Chamado" gated por FATO DE NEGÓCIO.
// O autor (from) nunca vai no body — vem do actionContext + canRepresentActor server-side
// (DECISION-0113). O backend PROVA que {from,to} são as duas partes reais do negócio referenciado;
// o frontend só oferece as referências elegíveis já resolvidas pelo backend (nunca inventa).

import { apiFetchJson } from './client';

export type SupportTicketReferenceType = 'order' | 'service_order' | 'booking';
export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface SupportTicket {
  id: string;
  referenceType: SupportTicketReferenceType;
  referenceId: string;
  fromActorId: string;
  toActorId: string;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EligibleBusinessFactReference {
  referenceType: SupportTicketReferenceType;
  referenceId: string;
  counterpartActorId: string;
  label: string;
}

/** Fatos de negócio reais entre mim e `withActorId` — para escolher qual referenciar no chamado. */
export async function listEligibleReferences(withActorId: string): Promise<EligibleBusinessFactReference[]> {
  const res = await apiFetchJson<{ ok: boolean; data: EligibleBusinessFactReference[] }>(
    `/support-tickets/eligible-references?withActorId=${withActorId}`
  );
  return res.data;
}

export async function openSupportTicket(input: {
  referenceType: SupportTicketReferenceType;
  referenceId: string;
  toActorId: string;
  subject: string;
  message: string;
}): Promise<SupportTicket> {
  const res = await apiFetchJson<{ ok: boolean; data: SupportTicket }>('/support-tickets', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function respondSupportTicket(id: string, status: SupportTicketStatus): Promise<SupportTicket> {
  const res = await apiFetchJson<{ ok: boolean; data: SupportTicket }>(`/support-tickets/${id}/respond`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
  return res.data;
}

export async function listMySupportTickets(status?: SupportTicketStatus): Promise<SupportTicket[]> {
  const q = status ? `?status=${status}` : '';
  const res = await apiFetchJson<{ ok: boolean; data: SupportTicket[]; total: number }>(`/support-tickets/mine${q}`);
  return res.data;
}
