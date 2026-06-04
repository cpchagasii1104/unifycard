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
 * Configuração inicial de agenda
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
  calendarConfig: CompanyCalendarConfig;
  completedAt?: string;     // ISO 8601
  completedBy?: string;      // userId
}

/**
 * Estado do wizard
 */
export interface CompanyOnboardingWizardState {
  currentStep: number;
  config: Partial<CompanyOnboardingConfig>;
  errors: Record<string, string>;
}




