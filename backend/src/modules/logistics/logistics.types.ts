/**
 * Modelo canónico de orquestração logística (P1 — desenho inicial).
 *
 * Rides executa pernas de transporte; este módulo descreve demanda, plano e matching
 * de capacidade — sem acoplamento a corridas nem a BD.
 */

export type TransportDemandType = 'food' | 'passenger' | 'cargo';

/** Urgência operacional para priorização de recurso (não é agenda canónica). */
export type TransportUrgency = 'low' | 'normal' | 'high';

export type VehicleType = 'moto' | 'car' | 'van' | 'truck';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface TransportDemand {
  type: TransportDemandType;
  /** Massa estimada (kg). */
  weight: number;
  /** Volume estimado (m³). */
  volume: number;
  /** Passageiros humanos (0 = só carga). */
  passengers: number;
  urgency: TransportUrgency;
  origin: GeoPoint;
  destination: GeoPoint;
}

export interface TransportLeg {
  vehicleType: VehicleType;
  origin: GeoPoint;
  destination: GeoPoint;
  /** Ordem na cadeia multi-leg (1-based). */
  sequence: number;
}

export interface TransportPlan {
  legs: TransportLeg[];
  /** Heurística aplicada (observabilidade / debug; não é SSOT). */
  plannerVersion: string;
}