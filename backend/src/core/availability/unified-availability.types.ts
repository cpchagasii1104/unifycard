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
 * 🔴 BLINDAGEM: Owner é polimórfico — identifica o RECURSO temporal, NÃO o actor
 * de autoridade (DECISION-0118 D2: resource owner ≠ authority actor; a autoridade
 * é resolvida server-side por policy em availability-owner-authority.ts).
 * Vocabulário ESPELHADO no CHECK físico chk_availability_owner_type
 * (migration 20260612110000) — não alterar um sem o outro.
 */
export enum AvailabilityOwnerType {
  USER = 'user',     // Disponibilidade de usuário (owner_id = actors.id humano)
  SERVICE = 'service', // Disponibilidade de serviço (owner_id = services.service_id)
  EVENT = 'event',   // Disponibilidade de evento (owner_id = events.id)
  GROUP = 'group',   // Disponibilidade de grupo (owner_id = groups.id)
  PAGE = 'page',     // Disponibilidade de página (owner_id = actors.id page)
  SERVICE_OFFERING = 'service_offering', // Oferta de serviço (owner_id = service_offerings.id — DECISION-0117 D)
  RENTABLE_RESOURCE = 'rentable_resource', // Recurso alugável (owner_id = rentable_resources.id — DECISION-0151 B; FASE 2a)
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
  // 🔴 DECISION-0132: finalidade temporal da janela (CONCEPT). NULL = legado/sem finalidade.
  purposeConceptId?: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
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
  purpose_concept_id: string | null; // DECISION-0132
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

/**
 * Linha do banco de dados (UnifiedBookingRow)
 *
 * B+A1 convergência (2026-05-14): schema canônico da migration
 * 20260530491000_create_unified_availability_tables.sql usa snake_case em
 * todas as colunas (requested_at, checked_in_at, checked_out_at, cancelled_at,
 * expired_at, confirmed_at). Definição anterior misturava camelCase em alguns
 * campos — drift que tornava `.toISOString()` em `undefined` (campo do row
 * não existia com nome camelCase). Exposto via smoke HTTP B+A.
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
  created_at: string;
  updated_at: string;
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
  // 🔴 DECISION-0132: finalidade temporal (concept_id já RESOLVIDO server-side; nunca slug cru). NULL = sem finalidade.
  purposeConceptId?: string | null;
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
  purposeConceptId?: string | null; // DECISION-0132 (concept_id resolvido; undefined = não tocar)
  metadata?: Record<string, any>;
}

/**
 * Input para criar booking
 * 🔴 BLINDAGEM: availabilityId e requesterActorId são OBRIGATÓRIOS
 */
export interface CreateUnifiedBookingInput {
  availabilityId: string; // OBRIGATÓRIO
  requesterActorId: string; // OBRIGATÓRIO (incremental; deve casar com BookingSubject.requesterActorId — DECISION-0148)
  notes?: string | null;
  metadata?: Record<string, any>;
}

/**
 * 🔴 DECISION-0148 — Booking Core Subject Model (Opção B). Subject NORMALIZADO que o core de booking
 * recebe e REVALIDA server-side (canRepresentActor). Substitui o `userId` genérico/poluído.
 *  - subjectUserId: id real do principal humano (casa com `actors.user_id`; NÃO actorId, NÃO global_user_id).
 *  - requesterActorId: actor em nome de quem o booking é criado.
 */
export interface BookingSubject {
  subjectUserId: string;
  requesterActorId: string;
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
  createdAt: string;
  updatedAt: string;
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
  created_at: string;
  updated_at: string;
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



