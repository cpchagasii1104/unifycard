// frontend/src/types/event-spec.ts
// Tipos para EventSpec - Especificação Declarativa de Evento

export type MacroIntention = 'celebrate' | 'gather' | 'teach' | 'present' | 'other';
export type Subflow = 'birthday_party' | 'wedding' | 'graduation' | 'other';

export interface QuestionnaireAnswers {
  [questionId: string]: any;
}

export interface EventSpec {
  spec_id: string;
  event_id?: string | null;
  tenant_id: string;
  actor_id: string;
  actor_type: 'user' | 'page' | 'group' | 'channel';
  spec_version: number;
  macro_intention: MacroIntention;
  subflow: Subflow;
  answers: QuestionnaireAnswers;
  created_at: string;
  created_by: string;
  metadata?: Record<string, any>;
}

export interface CreateEventSpecInput {
  tenant_id: string;
  actor_id: string;
  actor_type: 'user' | 'page' | 'group' | 'channel';
  macro_intention: MacroIntention;
  subflow: Subflow;
  answers: QuestionnaireAnswers;
  event_id?: string | null;
  metadata?: Record<string, any>;
}



