// frontend/src/types/company-onboarding.ts
// Tipos para o wizard de onboarding de empresa
//
// F-PJ-ONBOARDING-FRONTEND-ACTIVATION-PAIR (DECISION-0098): a classificação operacional
// da empresa (Momento 2) NÃO mora mais aqui. O enum legado `CompanyBusinessType` e o campo
// `businessType` em metadata foram REMOVIDOS — a verdade é o par soberano
// (primary_company_type_id, primary_concept_id), gravado pelo backend via
// POST /companies/:companyId/operational-activation. Este arquivo guarda apenas config de UX
// (módulos/papéis/agenda), que NÃO é fonte de verdade operacional.

/**
 * Módulos disponíveis para ativação
 */
export interface CompanyModules {
  services: boolean;      // Serviços
  events: boolean;        // Eventos
  calendar: boolean;      // Agenda
  financial: boolean;     // Financeiro (opcional)
}

/**
 * Papéis iniciais da empresa
 */
export interface CompanyInitialRoles {
  owner: boolean;         // Owner (sempre true para criador)
  manager: boolean;       // Manager
  staff: boolean;         // Staff
}

/**
 * Configuração inicial de agenda.
 * F-COMPANY-AGENDA-REAL-WIRING: DEPRECATED — a agenda real da empresa passou a materializar de
 * verdade no SSOT temporal (unified_availability, ownerType='page') via o editor rico
 * (AvailabilityScheduleEnhanced) já na Etapa 4 do wizard, não mais horário único aplicado a todos
 * os dias. Este shape só é mantido para ler registros ANTIGOS salvos em metadata.onboarding antes
 * desta frente — novos onboardings não gravam mais este campo.
 */
export interface CompanyCalendarConfig {
  defaultStartTime: string;  // HH:mm (ex: "09:00")
  defaultEndTime: string;    // HH:mm (ex: "18:00")
  activeDays: number[];       // 0=domingo, 1=segunda, ..., 6=sábado
  timezone: string;          // IANA timezone (ex: "America/Sao_Paulo")
}

/**
 * Configuração de UX do onboarding (NÃO é verdade operacional — a classificação canônica
 * é o par (primary_company_type_id, primary_concept_id), gravado pelo backend).
 */
export interface CompanyOnboardingConfig {
  modules: CompanyModules;
  initialRoles: CompanyInitialRoles;
  // F-COMPANY-AGENDA-REAL-WIRING: opcional — a agenda real vive em unified_availability agora
  // (ver CompanyCalendarConfig acima). Onboardings novos não populam mais este campo.
  calendarConfig?: CompanyCalendarConfig;
  completedAt?: string;     // ISO 8601
  completedBy?: string;      // actorId (DT-AVAILABLE-ACTOR-USER-ID-CONFUSION-RISK: era userId, NULL pra actor_type='page')
}

/**
 * Estado do wizard
 */
export interface CompanyOnboardingWizardState {
  currentStep: number;
  config: Partial<CompanyOnboardingConfig>;
  errors: Record<string, string>;
}




