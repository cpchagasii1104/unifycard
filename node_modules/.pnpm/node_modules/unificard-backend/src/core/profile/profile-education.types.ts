// src/core/profile/profile-education.types.ts
// Tipos para perfil educacional - MODELO 100% EVENT-BASED
// Educação é TEMPORAL, DECLARATIVA e BASEADA EM EVENTOS APPEND-ONLY
// NÃO decide, NÃO filtra, NÃO bloqueia, NÃO gera score

export type EducationType = 'formal' | 'informal' | 'autodidata';

// Eventos canônicos de educação (append-only)
export type EducationEventType =
  | 'educacao.declarada'
  | 'educacao.iniciada'
  | 'educacao.concluida'
  | 'educacao.abandonada'
  | 'educacao.contestada'
  | 'educacao.confirmada'
  | 'educacao.validada_institucionalmente';

export interface EducationEventPayload {
  educationId: string; // ID único da formação (pode ser gerado pelo sistema)
  type: EducationType; // Tipo de educação: formal, informal, autodidata
  institution?: string; // Instituição (texto livre)
  course?: string; // Curso / Formação (texto livre)
  startDate?: string; // Data de início (YYYY-MM ou YYYY-MM-DD)
  endDate?: string | null; // Data de conclusão (opcional) (YYYY-MM ou YYYY-MM-DD)
  description?: string; // Descrição adicional (opcional)
  // Campos específicos por tipo de evento
  reason?: string; // Para contestada/abandonada
  validator?: string; // Para validada_institucionalmente
  evidence?: string; // Para confirmada/validada
}

export interface EducationEvent {
  eventId: string;
  tenantId: string;
  actorId: string; // ID do actor que criou o evento
  eventType: EducationEventType;
  payload: EducationEventPayload;
  createdAt: string;
  version: number;
  metadata?: Record<string, unknown>;
}

// Read-model: projeção derivada dos eventos (somente para exibição)
export interface EducationEntry {
  educationId: string;
  type: EducationType;
  institution?: string;
  course?: string;
  startDate?: string;
  endDate?: string | null;
  description?: string;
  // Status derivado do último evento
  currentStatus: EducationEventType;
  // Histórico de eventos (opcional, para exibição)
  events?: Array<{
    eventType: EducationEventType;
    createdAt: string;
    metadata?: Record<string, unknown>;
  }>;
}

export interface EducationProfile {
  globalUserId: string;
  education: EducationEntry[];
}

// Input para criar evento educacional
export interface CreateEducationEventInput {
  eventType: EducationEventType;
  payload: EducationEventPayload;
}

