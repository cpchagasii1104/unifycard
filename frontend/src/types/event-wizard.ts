// frontend/src/types/event-wizard.ts
// Tipos para Event Wizard Adaptativo

/**
 * Tipo de evento (subtipos específicos)
 */
export type EventSubtype =
  | 'birthday'
  | 'wedding'
  | 'graduation'
  | 'baptism'
  | 'anniversary'
  | 'baby_shower'
  | 'gender_reveal'
  | 'engagement'
  | 'nightclub'
  | 'corporate'
  | 'show'
  | 'conference'
  | 'festival'
  | 'workshop'
  | 'other';

/**
 * Tipo de actor
 */
export type ActorType = 'user' | 'page' | 'group' | 'channel';

/**
 * Contexto do wizard
 */
export interface EventWizardContext {
  eventType: string; // cultural, gastronomic, social, etc.
  eventSubtype?: EventSubtype;
  actorType: ActorType;
  actorId: string;
}

/**
 * Pergunta do wizard
 */
export interface WizardQuestion {
  id: string;
  question: string;
  helpText?: string; // Balão explicativo
  type: 'yes_no' | 'multiple_choice' | 'text' | 'date' | 'number';
  options?: Array<{ value: string; label: string }>;
  required: boolean;
  skipCondition?: (answers: Record<string, any>) => boolean; // Condição para pular
  showCondition?: (answers: Record<string, any>) => boolean; // Condição para mostrar
}

/**
 * Sugestão de serviço
 */
export interface ServiceSuggestion {
  category: string;
  description: string;
  canCreateBundle: boolean; // Se pode criar bundle com outros serviços
  discoveryFilters?: {
    categoryId?: string;
    actorType?: ActorType;
  };
}

/**
 * Módulo a ativar
 */
export interface ModuleActivation {
  module: 'services' | 'bundles' | 'calendar' | 'financial';
  reason: string; // Por que ativar este módulo
}

/**
 * Configuração do wizard para um contexto específico
 */
export interface WizardConfiguration {
  context: EventWizardContext;
  questions: WizardQuestion[];
  serviceSuggestions: ServiceSuggestion[];
  moduleActivations: ModuleActivation[];
  skipSteps?: string[]; // IDs de perguntas que podem ser puladas
}

/**
 * Respostas do wizard
 */
export interface WizardAnswers {
  [questionId: string]: any;
}

/**
 * Configuração completa salva no metadata
 */
export interface EventWizardConfig {
  context: EventWizardContext;
  answers: WizardAnswers;
  serviceSuggestions: ServiceSuggestion[];
  moduleActivations: ModuleActivation[];
  needsAssistance: boolean; // Se usuário quer ajuda para organizar
  completedAt: string; // ISO 8601
  completedBy: string; // actorId (DT-AVAILABLE-ACTOR-USER-ID-CONFUSION-RISK: era userId, NULL pra actor_type='page')
  capacity?: {
    expectedAttendance: number;
    capacityClass: 'S' | 'M' | 'L' | 'XL' | 'XXL';
  };
  venueInfrastructure?: {
    available: string[];
    unavailable: string[];
    constraints: string[];
  };
}

