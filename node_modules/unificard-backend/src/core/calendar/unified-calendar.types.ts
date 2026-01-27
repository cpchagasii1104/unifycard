// backend/src/core/calendar/unified-calendar.types.ts
// Tipos para AGENDA UNIFICADA
// Consolida todas as fontes de agenda em uma única visão

/**
 * Fonte da entrada de agenda
 * Identifica DE ONDE vem cada entrada
 */
export enum CalendarEntrySource {
  SERVICE_AVAILABILITY = 'service_availability', // Tabela service_availability
  CALENDAR_EVENT = 'calendar_event',              // Tabela calendar_events
  UNIFIED_AVAILABILITY = 'unified_availability', // Tabela availability (unified)
  EVENT = 'event',                                // Tabela events
}

/**
 * Tipo de entrada de agenda
 * Define o estado/contexto da entrada
 */
export enum CalendarEntryType {
  AVAILABLE = 'available',      // Disponível para agendamento
  RESERVED = 'reserved',         // Reservado/Confirmado
  BLOCKED = 'blocked',          // Bloqueado manualmente
  UNAVAILABLE = 'unavailable',  // Indisponível
}

/**
 * Entrada Unificada de Agenda
 * 
 * REGRAS:
 * - NÃO duplica dados
 * - Sempre identifica source
 * - Sempre identifica tipo
 * - Nenhuma entrada ambígua
 */
export interface UnifiedCalendarEntry {
  // Identificação única
  id: string; // ID único (pode ser source:originalId)
  source: CalendarEntrySource; // DE ONDE vem
  sourceId: string; // ID original na fonte
  
  // Tipo e estado
  type: CalendarEntryType; // available, reserved, blocked, unavailable
  
  // Informações temporais
  startTime: Date;
  endTime: Date;
  timezone: string;
  
  // Informações contextuais
  title: string;
  description?: string | null;
  
  // Relacionamentos (opcionais, dependendo da fonte)
  actorId?: string | null; // Actor dono da agenda
  serviceId?: string | null; // Se relacionado a serviço
  eventId?: string | null; // Se relacionado a evento
  serviceOrderId?: string | null; // Se relacionado a service order
  availabilityId?: string | null; // Se relacionado a availability
  
  // Localização (opcional)
  locationAddress?: string | null;
  locationLatitude?: number | null;
  locationLongitude?: number | null;
  
  // Status específico da fonte (para referência)
  sourceStatus?: string | null;
  
  // Metadata da fonte original
  metadata: Record<string, any>;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Filtros para buscar agenda unificada
 */
export interface UnifiedCalendarFilters {
  actorId?: string; // Filtrar por actor dono da agenda
  serviceId?: string; // Filtrar por serviço
  eventId?: string; // Filtrar por evento
  source?: CalendarEntrySource; // Filtrar por fonte
  type?: CalendarEntryType; // Filtrar por tipo
  startTimeFrom?: Date; // Data/hora inicial
  startTimeTo?: Date; // Data/hora final
  limit?: number;
  offset?: number;
}




