// backend/src/core/profile/lifestyle/lifestyle.types.ts
//
// F2 (DECISION-0071) — SSOT Lifestyle actor-first. Atributo ENUMERADO declarado (NÃO concept, NÃO saúde,
// NÃO texto livre). consent explícito obrigatório; visibility private; remoção anonimiza (value NULL);
// audit SEM valor sensível. Espelha o substrato `actor_lifestyle_attributes` (migration 20260601170000).

export type LifestyleAttributeKey = 'relationship_status' | 'drinks' | 'smokes';

// Valores governados por key (espelham os CHECKs do schema; validação amigável no service).
export const LIFESTYLE_ALLOWED_VALUES: Record<LifestyleAttributeKey, readonly string[]> = {
  relationship_status: ['single', 'dating', 'in_relationship', 'married', 'prefer_not_to_say'],
  drinks: ['never', 'socially', 'regularly', 'prefer_not_to_say'],
  smokes: ['never', 'occasionally', 'regularly', 'prefer_not_to_say'],
} as const;

export const LIFESTYLE_ATTRIBUTE_KEYS: readonly LifestyleAttributeKey[] = [
  'relationship_status',
  'drinks',
  'smokes',
];

export type LifestyleAuditAction =
  | 'declare'
  | 'update'
  | 'consent_grant'
  | 'consent_revoke'
  | 'retire'
  | 'anonymize'
  | 'purge';

// Linha interna (espelha colunas vivas de actor_lifestyle_attributes).
export interface LifestyleAttributeRow {
  id: string;
  tenant_id: string;
  actor_id: string;
  attribute_key: LifestyleAttributeKey;
  attribute_value: string | null;
  visibility: string;
  consented_at: Date | null;
  consent_source: string | null;
  consent_version: string | null;
  is_active: boolean;
  declared_at: Date;
  updated_at: Date;
  retired_at: Date | null;
}

// Read dedicado do invariante de identidade do actor (id === actor_id).
export interface ActorIdentityCheckRow {
  id: string;
  actor_id: string;
}

// DTO de saída (camelCase). NUNCA expõe consent_source/version (proveniência interna).
export interface LifestyleAttributeDTO {
  attributeKey: LifestyleAttributeKey;
  attributeValue: string | null;
  visibility: string;
  isActive: boolean;
  consentedAt: string | null;
  declaredAt: string;
  updatedAt: string;
  retiredAt: string | null;
}

export interface LifestyleProfileDTO {
  attributes: LifestyleAttributeDTO[];
}

// Consentimento explícito (obrigatório p/ declarar). `granted` deve ser true; source/version = proveniência.
export interface ConsentInput {
  granted: boolean;
  source?: string | null;
  version?: string | null;
}

export interface DeclareLifestyleAttributeInput {
  attributeKey: LifestyleAttributeKey;
  attributeValue: string;
  consent: ConsentInput;
}

// Parâmetros internos para a escrita no repository (visibility é sempre 'private' — default do schema).
export interface PersistAttributeInput {
  attributeValue: string;
  consentedAt: Date;
  consentSource: string | null;
  consentVersion: string | null;
}

export interface InsertAuditInput {
  attributeKey: LifestyleAttributeKey;
  action: LifestyleAuditAction;
  performedByActorId: string | null;
  source: string;
  reason: string | null;
}
