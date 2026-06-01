// src/api/learningC1.ts
// API do Perfil de Aprendizado C1 (actor-first/concept-first, DECISION-0067) — usado SÓ pela aba Aprendizado (Fatia 4b).
// Contrato: WRITE e READ em camelCase (Fatia 2). Sem actorId no body — contexto/headers vêm do apiFetch.
// progress = estágio de exploração 1..3 (NÃO competência). source_category_id = breadcrumb.
import { apiFetch } from './client';

export interface LearningConceptC1 {
  conceptId: string;
  sourceCategoryId: string | null;
  progress: number | null;
  isActive: boolean;
  declaredAt: string;
  updatedAt: string;
  retiredAt: string | null;
}

export interface LearningC1 {
  concepts: LearningConceptC1[];
}

async function parseC1<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body && (body.error || body.message)) || `Erro ${res.status}`;
    throw new Error(typeof msg === 'string' ? msg : `Erro ${res.status}`);
  }
  return body as T;
}

export async function getLearningC1(): Promise<LearningC1> {
  const res = await apiFetch('/profile/learning/c1');
  return parseC1<LearningC1>(res);
}

export async function declareLearningConceptC1(input: {
  conceptId: string;
  sourceCategoryId?: string | null;
  progress?: number | null;
}): Promise<LearningConceptC1> {
  const res = await apiFetch('/profile/learning/c1/concepts', {
    method: 'POST',
    body: JSON.stringify({
      conceptId: input.conceptId,
      sourceCategoryId: input.sourceCategoryId ?? null,
      progress: input.progress ?? null,
    }),
  });
  return parseC1<LearningConceptC1>(res);
}

export async function updateLearningConceptC1(
  conceptId: string,
  patch: { progress?: number | null; sourceCategoryId?: string | null; reactivate?: true }
): Promise<LearningConceptC1> {
  // PATCH vazio é proibido pelo backend (400) — o caller só chama quando há campo material.
  const body: Record<string, unknown> = {};
  if (patch.progress !== undefined) body.progress = patch.progress;
  if (patch.sourceCategoryId !== undefined) body.sourceCategoryId = patch.sourceCategoryId;
  if (patch.reactivate !== undefined) body.reactivate = patch.reactivate;
  const res = await apiFetch(`/profile/learning/c1/concepts/${conceptId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return parseC1<LearningConceptC1>(res);
}

export async function retireLearningConceptC1(conceptId: string): Promise<LearningConceptC1> {
  const res = await apiFetch(`/profile/learning/c1/concepts/${conceptId}`, {
    method: 'DELETE',
  });
  return parseC1<LearningConceptC1>(res);
}
