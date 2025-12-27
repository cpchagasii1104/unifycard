// src/modules/events/occupancy.types.ts
// Tipos para Modelo de Ocupação de Eventos

export type OccupancyType = 'TABLE' | 'PERSON' | 'SLOT' | 'HYBRID';
export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'NO_SHOW' | 'CANCELLED';
export type ResourceType = 'TABLE' | 'PERSON' | 'SLOT';

// Configuração para ocupação por MESA
export interface TableOccupancyConfig {
  tables: Array<{
    id: string;
    name: string;
    capacity: number; // Pessoas por mesa
    price_cents?: number; // Preço da reserva (opcional)
    is_vip?: boolean;
  }>;
}

// Configuração para ocupação por PESSOA (em pé)
export interface PersonOccupancyConfig {
  sectors?: Array<{
    id: string;
    name: string;
    capacity: number;
    price_cents?: number;
  }>;
  total_capacity: number; // Capacidade total se não houver setores
}

// Configuração para ocupação por SLOT (agenda)
export interface SlotOccupancyConfig {
  slots: Array<{
    id: string;
    start_time: string; // ISO string
    end_time: string; // ISO string
    price_cents?: number;
  }>;
  slot_duration_minutes: number; // Duração padrão de cada slot
}

// Configuração HÍBRIDA (mesa + pessoa)
export interface HybridOccupancyConfig {
  table_config: TableOccupancyConfig;
  person_config: PersonOccupancyConfig;
}

// Modelo de ocupação completo
export interface EventOccupancyModel {
  id: string;
  event_id: string;
  tenant_id: string;
  occupancy_type: OccupancyType;
  total_capacity: number | null;
  requires_reservation: boolean;
  reservation_price_cents: number | null;
  reservation_currency: string;
  no_show_penalty_cents: number | null;
  no_show_penalty_currency: string;
  auto_cancel_after_minutes: number | null;
  config: TableOccupancyConfig | PersonOccupancyConfig | SlotOccupancyConfig | HybridOccupancyConfig;
  created_at: Date;
  updated_at: Date;
}

// Input para criar/atualizar modelo de ocupação
export interface CreateOccupancyModelInput {
  event_id: string;
  occupancy_type: OccupancyType;
  total_capacity?: number;
  requires_reservation?: boolean;
  reservation_price_cents?: number;
  reservation_currency?: string;
  no_show_penalty_cents?: number;
  no_show_penalty_currency?: string;
  auto_cancel_after_minutes?: number;
  config: TableOccupancyConfig | PersonOccupancyConfig | SlotOccupancyConfig | HybridOccupancyConfig;
}

// Reserva de recurso
export interface EventReservation {
  id: string;
  event_id: string;
  tenant_id: string;
  occupancy_model_id: string;
  global_user_id: string;
  resource_type: ResourceType;
  resource_id: string | null;
  resource_name: string | null;
  status: ReservationStatus;
  reservation_price_cents: number | null;
  reservation_currency: string;
  transaction_id: string | null;
  check_in_time: Date | null;
  no_show_time: Date | null;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

// Input para criar reserva
export interface CreateReservationInput {
  event_id: string;
  resource_type: ResourceType;
  resource_id?: string;
  resource_name?: string;
  reservation_price_cents?: number;
}

// Sugestão automática de modelo de ocupação
export interface OccupancyModelSuggestion {
  occupancy_type: OccupancyType;
  confidence: number;
  reasoning: string;
  suggested_config?: Partial<TableOccupancyConfig | PersonOccupancyConfig | SlotOccupancyConfig>;
}













