// frontend/src/api/offerings.ts
// B2 / F-OFFER-B2-FRONTEND-SERVICE-OFFERING-WIRING
// Wrapper do contrato canônico de service_offering (consome backend já provado em B1; pré-dinheiro).
// Disciplina: frontend PROJETA verdade resolvida — não cria/deriva identidade. canonicalServiceId vem do DTO
// de discovery (transportado). by-canonical retorna SÓ offerings ACTIVE (draft nunca vaza — gate no backend).

import { apiFetchJson } from './client';

export interface ServiceOffering {
  id: string;
  tenantId: string;
  canonicalServiceId: string;
  serviceId?: string | null;
  providerActorId: string;
  companyId?: string | null;
  professionalActorId?: string | null;
  priceCents: number;
  durationMinutes: number;
  modality?: string | null;
  status: 'draft' | 'active' | 'suspended';
}

/**
 * Lista as ofertas ATIVAS de um service canônico (discovery → seleção de oferta contratável).
 * GET /services/offerings/by-canonical/:canonicalServiceId → { ok, data: ServiceOffering[] } (active-only no backend).
 */
export async function getOfferingsByCanonical(canonicalServiceId: string): Promise<ServiceOffering[]> {
  const res = await apiFetchJson<{ ok: boolean; data: ServiceOffering[] }>(
    `/services/offerings/by-canonical/${canonicalServiceId}`
  );
  return res?.ok && Array.isArray(res.data) ? res.data : [];
}

/**
 * true se o erro for o conflito de horário por provider (DECISION-0146 / F-OFFER-5/6, HTTP 409
 * BOOKING_PROVIDER_TIME_CONFLICT). Usado para dar UX honesta específica em vez de erro genérico.
 */
export function isProviderTimeConflict(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  const code = e?.code;
  const msg = String(e?.message ?? '');
  return code === 'BOOKING_PROVIDER_TIME_CONFLICT' || /BOOKING_PROVIDER_TIME_CONFLICT/.test(msg);
}
