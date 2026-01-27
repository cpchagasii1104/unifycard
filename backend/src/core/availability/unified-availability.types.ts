// src/core/availability/unified-availability.types.ts
// Tipos do CORE de UNIFIED AVAILABILITY
// 🔴 BLINDAGEM: Availability NÃO decide quem pode agendar
// 🔴 BLINDAGEM: Availability NÃO faz pagamento
// 🔴 BLINDAGEM: Availability NÃO faz matching
// 🔴 BLINDAGEM: Availability apenas expõe janelas disponíveis
// 🔴 BLINDAGEM: Evita sobreposição de horários por owner
// 🔴 BLINDAGEM: Suporta capacidade opcional

/**
 * Tipo de Owner da Disponibilidade
 * 🔴 BLINDAGEM: Owner é polimórfico (user, service, event, group)
 */
export enum AvailabilityOwnerType {
  USER = 'user',     // Disponibilidade de usuário
  SERVICE = 'service', // Disponibilidade de serviço
  EVENT = 'event',   // Disponibilidade de evento
  GROUP = 'group',   // Disponibilidade de grupo
}

/**
 * Tipo de Disponibilidade
 * 🔴 BLINDAGEM: Tipo é contexto, não decisão
 */
export enum UnifiedAvailabilityType {
  FIXED = 'fixed',        // Janela fixa (ex: 09:00-18:00)
  RECURRING = 'recurring', // Recorrente (ex: toda segunda-feira 09:00-12:00)
  ON_DEMAND = 'on_demand', // Sob demanda (sem horário fixo)
}

/**
 * Status de Disponibilidade
 * 🔴 BLINDAGEM: Status é estado, não decisão
 */
export enum UnifiedAvailabilityStatus {
  ACTIVE = 'active',  // Ativa (janelas disponíveis)
  PAUSED = 'paused',  // Pausada (janelas não disponíveis)
}

/**
 * Status do Booking
 * 🔴 BLINDAGEM: Status é estado do pedido, não decisão
 * 🔴 BLINDAGEM: Check-in/check-out são apenas registro, NÃO executam pagamento
 */
export enum UnifiedBookingStatus {
  REQUESTED = 'requested',    // Pedido solicitado (aguardando resposta)
  CONFIRMED = 'confirmed',   // Confirmado (aceito)
  CANCELLED = 'cancelled',    // Cancelado
  EXPIRED = 'expired',        // Expirado
  CHECKED_IN = 'checked_in',  // Check-in realizado
  CHECKED_OUT = 'checked_out', // Check-out realizado
}

/**
 * Disponibilidade Unificada (entidade de domínio)
 * 🔴 BLINDAGEM: Availability pode pertencer a user, service, event ou group
 * 🔴 BLINDAGEM: NÃO decide quem pode agendar, apenas expõe janelas
 * 🔴 BLINDAGEM: Evita sobreposição de horários por owner
 */
export interface UnifiedAvailability {
  availabilityId: string;
  tenantId: string;
  ownerType: AvailabilityOwnerType; // OBRIGATÓRIO: Tipo do owner
  ownerId: string; // OBRIGATÓRIO: ID do owner
  availabilityType: UnifiedAvailabilityType;
  status: UnifiedAvailabilityStatus;
  startDatetime: Date;
  endDatetime: Date;
  timezone: string; // IANA timezone
  capacity?: number | null; // Capacidade (NULL = ilimitado)
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Booking Unificado (entidade de domínio)
 * 🔴 BLINDAGEM: Booking referencia availability, NÃO executa pagamento
 * 🔴 BLINDAGEM: Check-in/check-out são apenas registro, NÃO executam pagamento
 */
export interface UnifiedBooking {
  bookingId: string;
  tenantId: string;
  availabilityId: string; // OBRIGATÓRIO: Availability relacionada
  requesterActorId: string; // OBRIGATÓRIO: Actor que solicita o booking
  status: UnifiedBookingStatus;
  requestedAt: Date;
  checkedInAt?: Date | null; // Quando foi feito check-in
  checkedOutAt?: Date | null; // Quando foi feito check-out
  notes?: string | null; // Notas opcionais
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  cancelledAt?: Date | null;
  expiredAt?: Date | null;
  confirmedAt?: Date | null;
}

/**
 * Linha do banco de dados (UnifiedAvailabilityRow)
 */
export interface UnifiedAvailabilityRow {
  availability_id: string;
  tenant_id: string;
  owner_type: AvailabilityOwnerType;
  owner_id: string;
  availability_type: UnifiedAvailabilityType;
  status: UnifiedAvailabilityStatus;
  start_datetime: Date;
  end_datetime: Date;
  timezone: string;
  capacity: number | null;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

/**
 * Linha do banco de dados (UnifiedBookingRow)
 */
export interface UnifiedBookingRow {
  booking_id: string;
  tenant_id: string;
  availability_id: string;
  requester_actor_id: string;
  status: UnifiedBookingStatus;
  requested_at: Date;
  checked_in_at: Date | null;
  checked_out_at: Date | null;
  notes: string | null;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  cancelled_at: Date | null;
  expired_at: Date | null;
  confirmed_at: Date | null;
}

/**
 * Input para criar disponibilidade
 * 🔴 BLINDAGEM: ownerType e ownerId são OBRIGATÓRIOS
 */
export interface CreateUnifiedAvailabilityInput {
  ownerType: AvailabilityOwnerType; // OBRIGATÓRIO
  ownerId: string; // OBRIGATÓRIO
  availabilityType?: UnifiedAvailabilityType; // Default: 'fixed'
  status?: UnifiedAvailabilityStatus; // Default: 'active'
  startDatetime: Date; // OBRIGATÓRIO
  endDatetime: Date; // OBRIGATÓRIO
  timezone?: string; // Default: 'America/Sao_Paulo'
  capacity?: number | null; // Opcional
  metadata?: Record<string, any>;
}

/**
 * Input para atualizar disponibilidade
 */
export interface UpdateUnifiedAvailabilityInput {
  availabilityType?: UnifiedAvailabilityType;
  status?: UnifiedAvailabilityStatus;
  startDatetime?: Date;
  endDatetime?: Date;
  timezone?: string;
  capacity?: number | null;
  metadata?: Record<string, any>;
}

/**
 * Input para criar booking
 * 🔴 BLINDAGEM: availabilityId e requesterActorId são OBRIGATÓRIOS
 */
export interface CreateUnifiedBookingInput {
  availabilityId: string; // OBRIGATÓRIO
  requesterActorId: string; // OBRIGATÓRIO
  notes?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Input para atualizar booking
 * 🔴 BLINDAGEM: NÃO executa pagamento
 */
export interface UpdateUnifiedBookingInput {
  status?: UnifiedBookingStatus;
  notes?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Input para check-in
 * 🔴 BLINDAGEM: Check-in é apenas registro, NÃO executa pagamento
 */
export interface CheckInInput {
  metadata?: Record<string, any>;
}

/**
 * Input para check-out
 * 🔴 BLINDAGEM: Check-out é apenas registro, NÃO executa pagamento
 */
export interface CheckOutInput {
  metadata?: Record<string, any>;
}

/**
 * Filtros para busca de disponibilidades
 */
export interface UnifiedAvailabilityFilters {
  ownerType?: AvailabilityOwnerType;
  ownerId?: string;
  status?: UnifiedAvailabilityStatus;
  startDatetime?: Date;
  endDatetime?: Date;
}

/**
 * Filtros para busca de bookings
 */
export interface UnifiedBookingFilters {
  availabilityId?: string;
  requesterActorId?: string;
  status?: UnifiedBookingStatus;
}

/**
 * Role do Participante
 * 🔴 BLINDAGEM: Role é contexto, não decisão
 */
export enum ParticipantRole {
  EXECUTOR = 'executor',      // Executor principal (ex: músico principal)
  PARTICIPANTE = 'participante', // Participante (ex: membro da banda)
  CONVIDADO = 'convidado',    // Convidado (ex: convidado especial)
}

/**
 * Participante de Availability (entidade de domínio)
 * 🔴 BLINDAGEM: Participant é pessoa física (actor CPF) associada a uma availability
 * 🔴 BLINDAGEM: NÃO bloqueia automaticamente conflitos
 * 🔴 BLINDAGEM: Detecção de conflitos é ALERTA, não bloqueio
 */
export interface AvailabilityParticipant {
  participantId: string;
  tenantId: string;
  availabilityId: string; // OBRIGATÓRIO: Availability relacionada
  actorId: string; // OBRIGATÓRIO: Actor participante (CPF)
  role: ParticipantRole;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Linha do banco de dados (AvailabilityParticipantRow)
 */
export interface AvailabilityParticipantRow {
  participant_id: string;
  tenant_id: string;
  availability_id: string;
  actor_id: string;
  role: ParticipantRole;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

/**
 * Input para criar participante
 * 🔴 BLINDAGEM: availabilityId e actorId são OBRIGATÓRIOS
 */
export interface CreateAvailabilityParticipantInput {
  availabilityId: string; // OBRIGATÓRIO
  actorId: string; // OBRIGATÓRIO
  role?: ParticipantRole; // Default: 'participante'
  metadata?: Record<string, any>;
}

/**
 * Input para atualizar participante
 */
export interface UpdateAvailabilityParticipantInput {
  role?: ParticipantRole;
  metadata?: Record<string, any>;
}

/**
 * Filtros para busca de participantes
 */
export interface AvailabilityParticipantFilters {
  availabilityId?: string;
  actorId?: string;
  role?: ParticipantRole;
}

/**
 * Conflito de Horário Detectado
 * 🔴 BLINDAGEM: Conflito é DETECÇÃO, não decisão
 * 🔴 BLINDAGEM: A confirmação cabe ao usuário
 */
export interface AvailabilityConflict {
  conflictAvailabilityId: string;
  conflictStartDatetime: Date;
  conflictEndDatetime: Date;
  conflictOwnerType: AvailabilityOwnerType;
  conflictOwnerId: string;
}

/**
 * Resultado de Detecção de Conflitos
 * 🔴 BLINDAGEM: Resultado é ALERTA, não bloqueio
 * 🔴 BLINDAGEM: A confirmação cabe ao usuário
 */
export interface ConflictDetectionResult {
  hasConflicts: boolean;
  conflicts: AvailabilityConflict[];
  message?: string; // Mensagem de alerta (opcional)
}

