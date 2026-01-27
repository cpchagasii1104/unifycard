// frontend/src/types/company-onboarding.ts
// Tipos para o wizard de onboarding de empresa

/**
 * Tipo de empresa (negócio)
 */
export type CompanyBusinessType =
  | 'bar'
  | 'restaurant'
  | 'nightclub'
  | 'producer'
  | 'venue'
  | 'service_provider'
  | 'retail'
  | 'clinic'
  | 'other';

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
 * Configuração completa de onboarding
 */
export interface CompanyOnboardingConfig {
  businessType: CompanyBusinessType;
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




