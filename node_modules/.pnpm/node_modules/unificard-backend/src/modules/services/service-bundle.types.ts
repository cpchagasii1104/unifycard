// backend/src/modules/services/service-bundle.types.ts
// Tipos para SERVIÇOS COMBINADOS (Bundles) com co-agendamento
// 🔴 BLINDAGEM: Bundle é conceitual, não cria nova tabela
// Bundle vive em metadata dos bookings

/**
 * Tipo de dependência entre serviços no bundle
 */
export enum BundleDependencyType {
  SAME_TIME = 'same_time',        // Mesmo horário (obrigatório)
  SAME_LOCATION = 'same_location', // Mesma localização (obrigatório)
  PRIMARY_SECONDARY = 'primary_secondary', // Serviço primário + secundários
}

/**
 * Regras de validação do bundle
 */
export interface BundleValidationRules {
  requireAllAccepted: boolean;    // Todos devem aceitar ou nenhum confirma
  requireSameTime: boolean;        // Todos devem ter mesmo horário
  requireSameLocation: boolean;   // Todos devem ter mesma localização
  allowPartialCancellation: boolean; // Permite cancelar parcialmente
}

/**
 * Service Bundle (entidade conceitual)
 * 
 * REGRAS:
 * - NÃO cria nova tabela
 * - Bundle vive em metadata dos bookings
 * - Confirmação é atômica (todos ou nenhum)
 */
export interface ServiceBundle {
  bundleId: string;               // ID único do bundle
  tenantId: string;
  name: string;                   // Nome do bundle (ex: "Academia + Personal")
  description?: string | null;    // Descrição opcional
  serviceIds: string[];           // IDs dos serviços incluídos
  dependencyType: BundleDependencyType; // Tipo de dependência
  validationRules: BundleValidationRules; // Regras de validação
  createdAt: string;
  updatedAt: string;
}

/**
 * Input para criar bundle
 */
export interface CreateServiceBundleInput {
  name: string;
  description?: string | null;
  serviceIds: string[];           // Mínimo 2 serviços
  dependencyType: BundleDependencyType;
  validationRules?: Partial<BundleValidationRules>;
}

/**
 * Input para criar bookings de bundle (co-agendamento)
 * 
 * REGRAS:
 * - Cria múltiplos bookings vinculados
 * - Todos compartilham mesmo horário/localização se especificado
 * - Confirmação é atômica
 */
export interface CreateBundleBookingInput {
  bundleId: string;               // ID do bundle (ou gerar novo)
  serviceIds: string[];           // Serviços a agendar
  availabilityIds: string[];     // Disponibilidades correspondentes (mesma ordem)
  requesterActorId: string;       // Quem solicita
  scheduledStart: Date;           // Horário de início (compartilhado)
  scheduledEnd: Date;             // Horário de fim (compartilhado)
  locationAddress?: string | null; // Localização (compartilhada)
  locationLatitude?: number | null;
  locationLongitude?: number | null;
  notes?: string | null;          // Notas gerais do bundle
  dependencyType: BundleDependencyType; // Tipo de dependência
  metadata?: Record<string, any>; // Metadata adicional (ex: origem RFQ)
}

/**
 * Resultado da criação de bundle bookings
 */
export interface BundleBookingResult {
  bundleId: string;
  bookings: Array<{
    bookingId: string;
    serviceId: string;
    availabilityId: string;
    status: string;
  }>;
  canConfirm: boolean;            // Se todos os bookings podem ser confirmados
}

/**
 * Input para confirmar bundle (criar service orders de forma atômica)
 * 
 * REGRAS:
 * - Todos os bookings devem ter decisão ACCEPTED
 * - Todos os service orders são criados ou nenhum
 * - Agenda é bloqueada como conjunto
 */
export interface ConfirmBundleInput {
  bundleId: string;
  bookingIds: string[];          // IDs dos bookings do bundle
  decisionIds: string[];         // IDs das decisões (mesma ordem)
  confirmedByActorId: string;    // Quem confirma (organizador)
  confirmedByUserId?: string;
}

/**
 * Resultado da confirmação de bundle
 */
export interface ConfirmBundleResult {
  bundleId: string;
  serviceOrders: Array<{
    orderId: string;
    serviceId: string;
    bookingId: string;
    status: string;
  }>;
  calendarEvents: Array<{
    eventId: string;
    serviceOrderId: string;
  }>;
}


