// src/modules/services/service-booking-decision.types.ts
// Tipos do Domínio de CONFIRMAÇÃO / DECISÃO DE BOOKING
// 🔴 BLINDAGEM: Booking Decision = decisão humana explícita
// Nunca automática
// Nunca baseada em score, educação, aprendizado ou reputação

/**
 * Status da Decisão de Booking
 * 🔴 BLINDAGEM: Status é decisão humana explícita, nunca automática
 */
export enum BookingDecisionStatus {
  ACCEPTED = 'accepted', // Booking aceito (decisão humana explícita)
  REJECTED = 'rejected', // Booking rejeitado (decisão humana explícita)
}

/**
 * Decisão de Booking (entidade de domínio)
 * 🔴 BLINDAGEM: Booking Decision = decisão humana explícita
 * Nunca automática
 * Nunca baseada em score, educação, aprendizado ou reputação
 * Booking continua existindo mesmo se rejeitado
 * Decisão não apaga booking
 * Nada é sobrescrito
 */
export interface ServiceBookingDecision {
  decisionId: string;
  tenantId: string;
  bookingId: string; // OBRIGATÓRIO: Booking sobre o qual a decisão foi tomada
  decidedByActorId: string; // OBRIGATÓRIO: Actor que decide (dono do service)
  status: BookingDecisionStatus;
  decidedAt: Date;
  reason?: string | null; // Motivo da decisão (opcional)
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Linha do banco de dados (ServiceBookingDecisionRow)
 */
export interface ServiceBookingDecisionRow {
  decision_id: string;
  tenant_id: string;
  booking_id: string;
  decided_by_actor_id: string;
  status: BookingDecisionStatus;
  decidedAt: Date;
  reason: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input para criar decisão de booking
 * 🔴 BLINDAGEM: bookingId e decidedByActorId são OBRIGATÓRIOS
 * 🔴 BLINDAGEM: Decisão é humana explícita, nunca automática
 */
export interface CreateServiceBookingDecisionInput {
  bookingId: string; // OBRIGATÓRIO
  decidedByActorId: string; // OBRIGATÓRIO
  status: BookingDecisionStatus; // OBRIGATÓRIO: accepted ou rejected
  reason?: string | null;
  metadata?: Record<string, any>;
}



