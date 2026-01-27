// backend/src/modules/services/service-order.types.ts
// SPRINT 68: SERVICE ORDERS + AGENDA CANÔNICA

/**
 * Status da ordem de serviço
 */
export type ServiceOrderStatus = 'DRAFT' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

/**
 * Ordem de Serviço
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Append-only: status muda, mas registros não desaparecem
 * - Status declarativos
 * - Audit em todas as mudanças
 * - Nada automático sem ação explícita
 * - NÃO executa pagamentos
 * - NÃO emite fiscal
 */
export interface ServiceOrder {
  id: string;
  tenantId: string;
  serviceId: string;
  workerActorId: string;
  customerActorId: string;
  bookingId: string | null;
  decisionId: string | null;
  status: ServiceOrderStatus;
  scheduledStart: Date;
  scheduledEnd: Date | null;
  estimatedDurationMinutes: number | null;
  locationAddress: string | null;
  locationLatitude: number | null;
  locationLongitude: number | null;
  description: string | null;
  customerNotes: string | null;
  workerNotes: string | null;
  createdByActorId: string;
  createdByUserId: string | null;
  confirmedAt: Date | null;
  confirmedByActorId: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input para criar ordem de serviço
 */
export interface CreateServiceOrderInput {
  serviceId: string;
  workerActorId: string;
  customerActorId: string;
  bookingId?: string;
  decisionId?: string;
  scheduledStart: Date;
  scheduledEnd?: Date;
  estimatedDurationMinutes?: number;
  locationAddress?: string;
  locationLatitude?: number;
  locationLongitude?: number;
  description?: string;
  customerNotes?: string;
  metadata?: Record<string, any>;
}

/**
 * Input para confirmar ordem
 */
export interface ConfirmServiceOrderInput {
  confirmedByActorId: string;
  confirmedByUserId?: string;
}

/**
 * Input para iniciar ordem
 */
export interface StartServiceOrderInput {
  startedByActorId: string;
  startedByUserId?: string;
  workerNotes?: string;
}

/**
 * Input para completar ordem
 */
export interface CompleteServiceOrderInput {
  completedByActorId: string;
  completedByUserId?: string;
  workerNotes?: string;
}

/**
 * Input para cancelar ordem
 */
export interface CancelServiceOrderInput {
  cancelledByActorId: string;
  cancelledByUserId?: string;
  cancellationReason?: string;
}

/**
 * Filtros para listar ordens
 */
export interface ServiceOrderFilters {
  serviceId?: string;
  workerActorId?: string;
  customerActorId?: string;
  bookingId?: string;
  status?: ServiceOrderStatus;
  scheduledStartFrom?: Date;
  scheduledStartTo?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Termos financeiros de uma Service Order
 */
export interface ServiceOrderFinancialTerms {
  serviceOrderId: string;
  grossAmount: number; // Valor bruto em centavos
  platformFeePercentage: number; // Percentual da comissão (ex: 3 = 3%)
  platformFee: number; // Valor da comissão em centavos
  providerNetAmount: number; // Valor líquido do prestador em centavos
  currency: string;
  providerActorId: string;
  platformActorId: string; // ID da conta da plataforma
}

/**
 * Input para confirmar termos financeiros
 */
export interface ConfirmFinancialTermsInput {
  confirmedByActorId: string;
  confirmedByUserId?: string;
}




