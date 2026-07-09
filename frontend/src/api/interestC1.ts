// src/api/interestC1.ts
// API do Perfil de Interesse C1 (actor-first/concept-first, DECISION-0067) — usado SÓ pela seção de
// Interesses do ProfilePhysical (Fatia 4c). Espelha learningC1.ts.
// Contrato: WRITE e READ em camelCase (Fatia 2). Sem actorId no body — contexto/headers vêm do apiFetch.
// Interest MVP é BINÁRIO: declarar/remover. Sem progress/weight/priority. source_category_id = breadcrumb.
import { apiFetch } from './client';

export interface InterestConceptC1 {
  conceptId: string;
  sourceCategoryId: string | null;
  isActive: boolean;
  declaredAt: string;
  updatedAt: string;
  retiredAt: string | null;
}

export interface InterestC1 {
  concepts: InterestConceptC1[];
}

async function parseC1<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body && (body.error || body.message)) || `Erro ${res.status}`;
    throw new Error(typeof msg === 'string' ? msg : `Erro ${res.status}`);
  }
  return body as T;
}

export async function getInterestC1(): Promise<InterestC1> {
  const res = await apiFetch('/profile/interest/c1');
  return parseC1<InterestC1>(res);
}

export async function declareInterestConceptC1(input: {
  conceptId: string;
  sourceCategoryId?: string | null;
}): Promise<InterestConceptC1> {
  const res = await apiFetch('/profile/interest/c1/concepts', {
    method: 'POST',
    body: JSON.stringify({
      conceptId: input.conceptId,
      sourceCategoryId: input.sourceCategoryId ?? null,
    }),
  });
  return parseC1<InterestConceptC1>(res);
}

// MVP binário: PATCH só cobre breadcrumb/reativação (não há atributo mutável). Disponível mas não usado
// no fluxo core — reativação de concept retirado é follow-up (edge 409 conhecido).
export async function updateInterestConceptC1(
  conceptId: string,
  patch: { sourceCategoryId?: string | null; reactivate?: true }
): Promise<InterestConceptC1> {
  // PATCH vazio é proibido pelo backend (400) — o caller só chama quando há campo material.
  const body: Record<string, unknown> = {};
  if (patch.sourceCategoryId !== undefined) body.sourceCategoryId = patch.sourceCategoryId;
  if (patch.reactivate !== undefined) body.reactivate = patch.reactivate;
  const res = await apiFetch(`/profile/interest/c1/concepts/${conceptId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return parseC1<InterestConceptC1>(res);
}

export async function retireInterestConceptC1(conceptId: string): Promise<InterestConceptC1> {
  const res = await apiFetch(`/profile/interest/c1/concepts/${conceptId}`, {
    method: 'DELETE',
  });
  return parseC1<InterestConceptC1>(res);
}

// RFC-SHARED-SUBJECT-CONCEPT-POOL: busca no POOL DE ASSUNTO (mesma autoridade do tema de evento).
// Elegibilidade vem de shared_subject_concepts — não de categoria scope='interest' (navegação) nem de
// canonical_services flat. Retorna concepts declaráveis por conceptId.
export async function searchInterestConceptsC1(q: string): Promise<Array<{ key: string; conceptId: string; label: string }>> {
  const res = await apiFetch(`/profile/interest/c1/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data?.results) ? data.results : [];
}
