// backend/src/core/events/specs/event-spec.types.ts
// Tipos para EventSpec - Especificação Declarativa de Evento
// ⚠️ REGRA INSTITUCIONAL: EventSpec NÃO decide nada. É apenas especificação declarada pelo usuário.

/**
 * Versão do EventSpec
 * Incrementar quando houver mudança estrutural incompatível
 */
export type EventSpecVersion = 1;

/**
 * Macro-intenção do evento
 */
export type MacroIntention = 'celebrate' | 'gather' | 'teach' | 'present' | 'other';

/**
 * Subfluxo específico dentro de uma macro-intenção
 */
export type Subflow = 'birthday_party' | 'wedding' | 'graduation' | 'other';

/**
 * Respostas do questionário
 * Estrutura flexível que armazena respostas por question_id
 */
export interface QuestionnaireAnswers {
  [questionId: string]: any;
}

/**
 * EventSpec - Especificação Declarativa de Evento
 * 
 * ⚠️ REGRA INSTITUCIONAL:
 * - EventSpec é um SNAPSHOT IMUTÁVEL
 * - NÃO é usado para decisão de negócio
 * - NÃO é usado para ranking
 * - NÃO é usado para score
 * - É apenas especificação declarada pelo usuário
 * 
 * O EventSpec é gerado ao final do fluxo de questionário
 * e armazenado como snapshot versionado para auditoria.
 */
export interface EventSpec {
  // Identificação
  spec_id: string; // UUID único do spec
  event_id: string; // 🔴 P0-2: OBRIGATÓRIO - ID do evento associado (draft)
  tenant_id: string;
  actor_id: string;
  actor_type: 'user' | 'page' | 'group' | 'channel';
  
  // Versão e tipo
  spec_version: EventSpecVersion; // Versão do schema do EventSpec
  macro_intention: MacroIntention;
  subflow: Subflow;
  
  // Respostas do questionário
  answers: QuestionnaireAnswers;
  
  // Metadados de criação
  created_at: string; // ISO 8601
  created_by: string; // user_id que preencheu o questionário
  
  // Metadados opcionais
  metadata?: {
    questionnaire_version?: number; // Versão do DSL usado
    completed_steps?: string[]; // IDs dos steps completados
    skipped_steps?: string[]; // IDs dos steps pulados (se houver)
    [key: string]: any; // Outros metadados
  };
}

/**
 * Input para criar EventSpec
 */
export interface CreateEventSpecInput {
  tenant_id: string;
  actor_id: string;
  actor_type: 'user' | 'page' | 'group' | 'channel';
  macro_intention: MacroIntention;
  subflow: Subflow;
  answers: QuestionnaireAnswers;
  event_id: string; // 🔴 P0-2: OBRIGATÓRIO - EventSpec sempre referencia Event existente (draft)
  metadata?: Record<string, any>;
}

/**
 * Resultado da validação do EventSpec
 */
export interface EventSpecValidation {
  valid: boolean;
  errors?: Array<{
    field: string;
    message: string;
  }>;
  warnings?: Array<{
    field: string;
    message: string;
  }>;
}

/**
 * Query para buscar EventSpecs
 */
export interface EventSpecQuery {
  tenant_id?: string;
  actor_id?: string;
  actor_type?: 'user' | 'page' | 'group' | 'channel';
  macro_intention?: MacroIntention;
  subflow?: Subflow;
  event_id?: string;
  spec_version?: EventSpecVersion;
  limit?: number;
  offset?: number;
}



