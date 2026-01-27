// src/core/profile/profile-health.types.ts
// Tipos para autodeclaração de saúde V2 (raio-x estruturado)

export type HealthSection = 'general' | 'vision' | 'dental' | 'medications' | 'mobility' | 'mental' | 'other';

export interface HealthDeclaration {
  id: string;
  tenantId: string;
  actorId: string;
  declarationText: string; // Texto livre (compatibilidade)
  notes: string | null;
  consent: boolean;
  // V2: Campos estruturados
  section: HealthSection | null;
  payload: Record<string, any> | null; // Dados estruturados (JSONB)
  consentScope: string | null; // Consentimento granular por seção
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateHealthDeclarationInput {
  declarationText?: string; // Opcional se payload for fornecido
  notes?: string | null;
  consent: boolean; // OBRIGATÓRIO - deve ser true
  // V2: Campos estruturados
  section?: HealthSection;
  payload?: Record<string, any>; // Dados estruturados
  consentScope?: string; // Escopo do consentimento
}

export interface HealthDeclarationRow {
  id: string;
  tenant_id: string;
  actor_id: string;
  declaration_text: string;
  notes: string | null;
  consent: boolean;
  // V2: Campos estruturados
  section: HealthSection | null;
  payload: Record<string, any> | null;
  consent_scope: string | null;
  created_at: Date;
  updated_at: Date;
}

