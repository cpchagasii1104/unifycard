// src/core/events/event.types.ts
// Tipos para o domínio de eventos conforme CONTRATO DE EVENTOS v1

/**
 * Taxonomia oficial de event_type (CONTRATO v1 Seção 3)
 */
export type EventType = 
  | 'cultural'
  | 'gastronomic'
  | 'social'
  | 'professional'
  | 'community'
  | 'spiritual'
  | 'sports'
  | 'private';

/**
 * Status canônico do evento (EVENT_DOMAIN_MINIMUM_CONTRACT)
 * Estados canônicos: draft, declared, published, active, ended, cancelled
 * 
 * Status legacy (deprecated, mantidos para compatibilidade):
 * - completed (mapear para 'ended')
 * - archived (mapear para 'ended' ou manter como legacy)
 */
export type EventStatus = 
  | 'draft'      // Rascunho, sem efeito institucional
  | 'declared'   // Declaração formal criada
  | 'published'  // Visível conforme regras de visibilidade
  | 'active'     // Em andamento
  | 'ended'      // Encerrado
  | 'cancelled'  // Cancelado
  | 'completed'  // 🔴 LEGACY: usar 'ended' em novos eventos
  | 'archived';  // 🔴 LEGACY: usar 'ended' em novos eventos

/**
 * Visibility do evento (CONTRATO v1)
 */
export type EventVisibility = 
  | 'public'
  | 'group'
  | 'followers'
  | 'private'
  | 'unlisted';

/**
 * Tipo de Actor (CONTRATO v1 Seção 1.1)
 * 🔴 BLINDAGEM: Tipos 'group' e 'channel' existem no banco, mas não estão habilitados
 * para emissão de eventos ainda. Mantidos para alinhamento com schema do banco.
 */
export type ActorType = 'user' | 'page' | 'group' | 'channel';

/**
 * Matriz Actor × EventType (CONTRATO v1 Seção 4)
 */
/**
 * 🔴 BLINDAGEM: group e channel não estão habilitados para emissão de eventos ainda.
 * Definidos como false explicitamente para evitar uso acidental.
 */
export const ACTOR_EVENT_TYPE_MATRIX: Record<EventType, { user: boolean; page: boolean; group: boolean; channel: boolean }> = {
  cultural: { user: true, page: true, group: false, channel: false },
  gastronomic: { user: true, page: true, group: false, channel: false },
  social: { user: true, page: false, group: false, channel: false },
  professional: { user: true, page: true, group: false, channel: false },
  community: { user: true, page: true, group: false, channel: false },
  spiritual: { user: true, page: true, group: false, channel: false },
  sports: { user: true, page: true, group: false, channel: false },
  private: { user: true, page: false, group: false, channel: false },
};

/**
 * Janela de tempo declarativa (EVENT_DOMAIN_MINIMUM_CONTRACT FASE 3)
 * Expressa intenção de quando o evento pode ocorrer
 * 
 * 🔴 DECLARAÇÃO PURA: NÃO é inferida, NÃO é autocorrigida, NÃO é decidida
 */
export interface EventTimeWindow {
  start_datetime: string; // ISO 8601
  end_datetime: string; // ISO 8601
  timezone?: string; // Opcional: IANA timezone (ex: "America/Sao_Paulo")
}

/**
 * Nível de flexibilidade declarativo (EVENT_DOMAIN_MINIMUM_CONTRACT FASE 3)
 * 
 * 🔴 DADO, NÃO REGRA: É apenas informação declarada pelo usuário
 */
export type FlexibilityLevel = 'strict' | 'flexible' | 'very_flexible';

/**
 * EventDeclaration - Subdocumento declarativo do agregado Event
 * Expressa intenção, não execução (EVENT_DOMAIN_MINIMUM_CONTRACT Seção 4)
 * 
 * 🔴 VALIDAÇÃO OBRIGATÓRIA:
 * - event_aspects deve ser validado contra vocabulário fechado (EventAspectsService)
 * - aspects_version indica a versão do vocabulário usado
 * - NÃO aceita texto livre em event_aspects
 * - desired_time_windows é APENAS declaração explícita (sem inferência)
 */
export interface EventDeclaration {
  title: string;
  description?: string | null;
  event_aspects: string[]; // Validado contra vocabulário fechado (obrigatório)
  aspects_version: string; // Versão do vocabulário usado (ex: "v1")
  visibility: EventVisibility;
  intent_flags?: string[]; // Opcional: validado contra allowlist
  declared_at: string; // ISO 8601
  
  // FASE 3: Declared Time Windows
  desired_time_windows?: EventTimeWindow[]; // Opcional: declaração explícita de janelas desejadas
  flexibility_level?: FlexibilityLevel; // Opcional: nível de flexibilidade declarado
  timezone?: string; // Opcional: timezone padrão para as janelas
}

/**
 * Evento conforme CONTRATO v1 e EVENT_DOMAIN_MINIMUM_CONTRACT
 * 
 * 🔴 NOTA: responsible_actor_id é alias de actor_id no domínio.
 * No banco pode continuar usando actor_id por enquanto.
 */
export interface Event {
  id: string;
  tenant_id: string;
  actor_id: string; // 🔴 LEGACY: usar responsible_actor_id no domínio
  actor_type: ActorType;
  event_type: EventType;
  event_subtype?: string | null;
  title: string;
  description?: string | null;
  datetime_start: string; // ISO 8601
  datetime_end: string; // ISO 8601
  status: EventStatus;
  visibility: EventVisibility;
  ticket_price_cents?: number | null;
  max_attendees?: number | null;
  completed_at?: string | null; // ISO 8601
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
  metadata?: Record<string, any>;
  
  // 🔴 DOMÍNIO CANÔNICO: Aliases e campos derivados
  /** Alias canônico para actor_id (EVENT_DOMAIN_MINIMUM_CONTRACT) */
  responsible_actor_id?: string; // Derivado de actor_id
  /** Alias canônico para actor_type */
  responsible_actor_type?: ActorType; // Derivado de actor_type
  /** Declaração do evento (quando existir) */
  declaration?: EventDeclaration | null;
}

/**
 * Input para criar evento
 * 
 * 🔴 FASE 5: datetime_start e datetime_end são opcionais
 * Validação por etapa: ETAPA 0 não requer datas (serão definidas em ETAPA 3)
 */
export interface CreateEventInput {
  actor_id: string;
  actor_type: ActorType;
  event_type: EventType;
  event_subtype?: string | null;
  title: string;
  description?: string | null;
  datetime_start?: string; // ISO 8601 - Opcional (FASE 5: validação por etapa)
  datetime_end?: string; // ISO 8601 - Opcional (FASE 5: validação por etapa)
  visibility?: EventVisibility;
  ticket_price_cents?: number | null;
  max_attendees?: number | null;
  metadata?: Record<string, any>;
}

/**
 * Input para atualizar evento
 */
export interface UpdateEventInput {
  title?: string;
  description?: string | null;
  datetime_start?: string; // ISO 8601
  datetime_end?: string; // ISO 8601
  event_subtype?: string | null;
  visibility?: EventVisibility;
  ticket_price_cents?: number | null;
  max_attendees?: number | null;
  metadata?: Record<string, any>;
}

/**
 * Resultado de moderação (CONTRATO v1 Seção 7.2)
 */
export interface ModerationResult {
  decision: 'approved' | 'flagged' | 'rejected';
  reason?: string;
  confidence?: number;
  flags?: string[];
}

/**
 * Resultado de validação Actor × EventType
 */
export interface ActorEventTypeValidation {
  valid: boolean;
  reason?: string;
}

/**
 * Input para declarar evento (EVENT_DOMAIN_MINIMUM_CONTRACT)
 * 
 * 🔴 OBRIGATÓRIO: event_aspects deve ser fornecido explicitamente
 * Não há inferência automática. Deve ser validado contra vocabulário fechado.
 * 
 * FASE 3: desired_time_windows é APENAS declaração explícita (sem inferência)
 */
export interface DeclareEventInput {
  title: string;
  description?: string | null;
  event_aspects: string[]; // OBRIGATÓRIO: validado contra vocabulário fechado
  visibility: EventVisibility;
  intent_flags?: string[]; // Opcional: validado contra allowlist
  
  // FASE 3: Declared Time Windows
  desired_time_windows?: EventTimeWindow[]; // Opcional: declaração explícita
  flexibility_level?: FlexibilityLevel; // Opcional: nível de flexibilidade
  timezone?: string; // Opcional: timezone padrão
}

/**
 * Mapeamento de status legacy para canônico
 */
export function mapLegacyStatusToCanonical(status: string): EventStatus {
  switch (status) {
    case 'completed':
      return 'ended';
    case 'archived':
      return 'ended';
    default:
      return status as EventStatus;
  }
}














