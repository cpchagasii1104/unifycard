// src/api/professionalC1.ts
// API do Perfil Profissional C1 (actor-first, DECISION-0063) — usado SÓ pela aba Profissional (A3.2).
// Contrato: WRITE em snake_case; READ (DTO) em camelCase; wrapper `professional_bio` é snake.
// Sem actorId no body — contexto/headers vêm do apiFetch (Authorization / x-tenant-id / x-action-context).
import { apiFetch } from './client';

export interface ProfessionalConceptC1 {
  conceptId: string;
  sourceCategoryId: string | null;
  skillLevel: number;
  yearsExperience: number | null;
  isActive: boolean;
  declaredAt: string;
  updatedAt: string;
  retiredAt: string | null;
}

export interface ProfessionalC1 {
  concepts: ProfessionalConceptC1[];
  professional_bio: string | null;
}

async function parseC1<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body && (body.error || body.message)) || `Erro ${res.status}`;
    throw new Error(typeof msg === 'string' ? msg : `Erro ${res.status}`);
  }
  return body as T;
}

export async function getProfessionalC1(): Promise<ProfessionalC1> {
  const res = await apiFetch('/profile/professional/c1');
  return parseC1<ProfessionalC1>(res);
}

export async function updateProfessionalBioC1(
  professionalBio: string | null
): Promise<{ professional_bio: string | null }> {
  const res = await apiFetch('/profile/professional/c1/bio', {
    method: 'PUT',
    body: JSON.stringify({ professional_bio: professionalBio }),
  });
  return parseC1<{ professional_bio: string | null }>(res);
}

export async function declareProfessionalConceptC1(input: {
  conceptId: string;
  sourceCategoryId?: string | null;
  skillLevel: number;
  yearsExperience?: number | null;
}): Promise<ProfessionalConceptC1> {
  const res = await apiFetch('/profile/professional/c1/concepts', {
    method: 'POST',
    body: JSON.stringify({
      concept_id: input.conceptId,
      source_category_id: input.sourceCategoryId ?? null,
      skill_level: input.skillLevel,
      years_experience: input.yearsExperience ?? null,
    }),
  });
  return parseC1<ProfessionalConceptC1>(res);
}

export async function updateProfessionalConceptC1(
  conceptId: string,
  patch: { skillLevel?: number; yearsExperience?: number | null; reactivate?: true }
): Promise<ProfessionalConceptC1> {
  // PATCH vazio é proibido pelo backend (400) — o caller só chama quando há campo material.
  const body: Record<string, unknown> = {};
  if (patch.skillLevel !== undefined) body.skill_level = patch.skillLevel;
  if (patch.yearsExperience !== undefined) body.years_experience = patch.yearsExperience;
  if (patch.reactivate !== undefined) body.reactivate = patch.reactivate;
  const res = await apiFetch(`/profile/professional/c1/concepts/${conceptId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return parseC1<ProfessionalConceptC1>(res);
}

export async function retireProfessionalConceptC1(
  conceptId: string
): Promise<ProfessionalConceptC1> {
  const res = await apiFetch(`/profile/professional/c1/concepts/${conceptId}`, {
    method: 'DELETE',
  });
  return parseC1<ProfessionalConceptC1>(res);
}
