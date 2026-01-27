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
  start_datetime: string; // ISO 8601
  end_datetime: string; // ISO 8601
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
  event_id: string;
  tenant_id: string; // Derivado do event
  
  // Actor explícito obrigatório (CANÔNICO)
  responsible_actor_id: string;
  responsible_actor_type: 'user' | 'page' | 'group' | 'channel';
  
  role: OperationalCommitmentRole;
  status: OperationalCommitmentStatus;
  
  // Referência a janela de tempo (opcional, apenas referência)
  time_window_ref?: TimeWindowRef | null;
  
  // Timestamps de check-in/check-out
  checked_in_at?: string | null; // ISO 8601
  checked_out_at?: string | null; // ISO 8601
  
  // Motivo de falha (se status = failed)
  failure_reason?: string | null;
  
  // Rastreamento de origem
  source?: 'legacy' | 'v2';
  
  // Timestamps
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
  
  // 🔴 LEGACY: Mantido para compatibilidade
  global_user_id?: string | null;
  assigned_by_global_user_id?: string | null;
}

/**
 * Input para criar OperationalCommitment
 */
export interface CreateOperationalCommitmentInput {
  event_id: string;
  responsible_actor_id: string; // Obrigatório, explícito
  responsible_actor_type: 'user' | 'page' | 'group' | 'channel';
  role: OperationalCommitmentRole;
  time_window_ref?: TimeWindowRef | null;
}

/**
 * Input para check-in
 */
export interface CheckInInput {
  observed_at?: string; // ISO 8601 (opcional, usa now() se não fornecido)
  observed_by_actor_id?: string; // Opcional: quem observou o check-in
  observed_by_actor_type?: 'user' | 'page' | 'group' | 'channel';
}

/**
 * Input para check-out
 */
export interface CheckOutInput {
  observed_at?: string; // ISO 8601 (opcional, usa now() se não fornecido)
  observed_by_actor_id?: string; // Opcional: quem observou o check-out
  observed_by_actor_type?: 'user' | 'page' | 'group' | 'channel';
}

/**
 * Input para marcar como failed
 */
export interface MarkFailedInput {
  failure_reason: string; // Obrigatório
  observed_at?: string; // ISO 8601 (opcional, usa now() se não fornecido)
}

