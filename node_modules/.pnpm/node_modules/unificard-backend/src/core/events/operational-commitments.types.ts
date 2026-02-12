// backend/src/core/events/operational-commitments.types.ts
// Types para OperationalCommitment (FASE 4: sem economia)
// EVENT_DOMAIN_MINIMUM_CONTRACT

/**
 * Status do lifecycle factual de OperationalCommitment
 * 
 * 🔴 FACTUAL: São fatos registrados, não decisões
 * - expected: compromisso esperado (criado)
 * - checked_in: check-in realizado
 * - checked_out: check-out realizado
 * - failed: falhou (marcado explicitamente)
 * 
 * Sem economia, sem punição, sem decisão automática.
 */
export type OperationalCommitmentStatus = 
  | 'expected'
  | 'checked_in'
  | 'checked_out'
  | 'failed';

/**
 * Role do compromisso operacional
 * 
 * String controlada, mas não inventar taxonomia gigante.
 * Validação mínima em código.
 */
export type OperationalCommitmentRole = string;

/**
 * Referência a janela de tempo (apenas referência, sem lock)
 * 
 * 🔴 REFERÊNCIA PURA: Não cria lock, não valida disponibilidade
 * Armazenado como JSONB informacional.
 */
export interface TimeWindowRef {
  startDatetime: string; // ISO 8601
  endDatetime: string; // ISO 8601
  timezone?: string; // IANA timezone (opcional)
}

/**
 * OperationalCommitment - Entidade operacional canônica
 * 
 * 🔴 OPERATIONALCOMMITMENT É FACTUAL, SEM ECONOMIA
 * 
 * É factual: registra fatos (check-in/check-out) sem decisões.
 * Check-in/check-out são fatos registrados, não decisões.
 * Sem punição automática nesta fase.
 * Agenda é referência, sem lock.
 * 
 * 🔴 ANTI-RESPONSABILIDADES:
 * - NÃO tem economia (sem amount_cents, payment_type, payout)
 * - NÃO tem punição (sem penalty, reputation, score)
 * - NÃO escreve na Agenda Universal (apenas referência)
 * - NÃO decide mérito ou disputas
 */
export interface OperationalCommitment {
  id: string;
  eventId: string;
  tenantId: string; // Derivado do event
  
  // Actor explícito obrigatório (CANÔNICO)
  responsibleActorId: string;
  responsibleActorType: 'user' | 'page' | 'group' | 'channel';
  
  role: OperationalCommitmentRole;
  status: OperationalCommitmentStatus;
  
  // Referência a janela de tempo (opcional, apenas referência)
  timeWindowRef?: TimeWindowRef | null;
  
  // Timestamps de check-in/check-out
  checkedInAt?: string | null; // ISO 8601
  checkedOutAt?: string | null; // ISO 8601
  
  // Motivo de falha (se status = failed)
  failureReason?: string | null;
  
  // Rastreamento de origem
  source?: 'legacy' | 'v2';
  
  // Timestamps
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  
  // 🔴 LEGACY: Mantido para compatibilidade
  globalUserId?: string | null;
  assignedByGlobalUserId?: string | null;
}

/**
 * Input para criar OperationalCommitment
 */
export interface CreateOperationalCommitmentInput {
  eventId: string;
  responsibleActorId: string; // Obrigatório, explícito
  responsibleActorType: 'user' | 'page' | 'group' | 'channel';
  role: OperationalCommitmentRole;
  timeWindowRef?: TimeWindowRef | null;
}

/**
 * Input para check-in
 */
export interface CheckInInput {
  observedAt?: string; // ISO 8601 (opcional, usa now() se não fornecido)
  observedByActorId?: string; // Opcional: quem observou o check-in
  observedByActorType?: 'user' | 'page' | 'group' | 'channel';
}

/**
 * Input para check-out
 */
export interface CheckOutInput {
  observedAt?: string; // ISO 8601 (opcional, usa now() se não fornecido)
  observedByActorId?: string; // Opcional: quem observou o check-out
  observedByActorType?: 'user' | 'page' | 'group' | 'channel';
}

/**
 * Input para marcar como failed
 */
export interface MarkFailedInput {
  failureReason: string; // Obrigatório
  observedAt?: string; // ISO 8601 (opcional, usa now() se não fornecido)
}

