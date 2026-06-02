// src/api/lifestyle.ts
// API do SSOT Lifestyle actor-first (DECISION-0071, F3) — usado pela seção "Estilo de Vida" do ProfilePhysical.
// Atributos DECLARADOS, sensíveis: relationship_status / drinks / smokes. **sexualOrientation NÃO existe aqui.**
// visibility é sempre 'private' (não é parâmetro). Consentimento explícito obrigatório para declarar.
import { apiFetch } from './client';

export type LifestyleAttributeKey = 'relationship_status' | 'drinks' | 'smokes';

export interface LifestyleAttribute {
  attributeKey: LifestyleAttributeKey;
  attributeValue: string | null;
  visibility: string;
  isActive: boolean;
  consentedAt: string | null;
  declaredAt: string;
  updatedAt: string;
  retiredAt: string | null;
}

export interface LifestyleProfile {
  attributes: LifestyleAttribute[];
}

export interface LifestyleConsent {
  accepted: true;
  source?: string;
  version?: string;
}

async function parse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body && (body.error || body.message)) || `Erro ${res.status}`;
    throw new Error(typeof msg === 'string' ? msg : `Erro ${res.status}`);
  }
  return body as T;
}

export async function getLifestyle(): Promise<LifestyleProfile> {
  const res = await apiFetch('/profile/lifestyle');
  return parse<LifestyleProfile>(res);
}

// Declara/atualiza um atributo. Consentimento explícito obrigatório (accepted=true). visibility private (backend).
export async function declareLifestyleAttribute(
  attributeKey: LifestyleAttributeKey,
  attributeValue: string,
  consent: LifestyleConsent
): Promise<LifestyleAttribute> {
  const res = await apiFetch(`/profile/lifestyle/attributes/${attributeKey}`, {
    method: 'PUT',
    body: JSON.stringify({ attributeValue, consent }),
  });
  return parse<LifestyleAttribute>(res);
}

// Retira (desativa) + anonimiza o valor.
export async function retireLifestyleAttribute(
  attributeKey: LifestyleAttributeKey
): Promise<LifestyleAttribute> {
  const res = await apiFetch(`/profile/lifestyle/attributes/${attributeKey}`, {
    method: 'DELETE',
  });
  return parse<LifestyleAttribute>(res);
}
