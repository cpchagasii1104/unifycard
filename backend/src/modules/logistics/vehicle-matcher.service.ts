/**
 * Matriz de capacidade: Demand → VehicleType.
 * Sem regras de produto por vertical (“pizza vs mudança”); só atributos físicos e passageiros.
 */
import type { TransportDemand, VehicleType } from './logistics.types';

const WEIGHT_TRUCK_KG = 800;
const VOLUME_TRUCK_M3 = 12;
const WEIGHT_VAN_KG = 400;
const VOLUME_VAN_M3 = 6;
const WEIGHT_CAR_KG = 150;
const VOLUME_CAR_M3 = 2;

export function matchVehicleForDemand(demand: TransportDemand): VehicleType {
  const { type, weight, volume, passengers } = demand;

  if (type === 'passenger') {
    if (passengers <= 1) return 'moto';
    if (passengers <= 4) return 'car';
    return 'van';
  }

  if (type === 'food') {
    if (weight > WEIGHT_CAR_KG || volume > VOLUME_CAR_M3) return 'car';
    return 'moto';
  }

  // cargo
  if (weight >= WEIGHT_TRUCK_KG || volume >= VOLUME_TRUCK_M3) return 'truck';
  if (weight >= WEIGHT_VAN_KG || volume >= VOLUME_VAN_M3) return 'van';
  if (weight >= WEIGHT_CAR_KG || volume >= VOLUME_CAR_M3) return 'car';
  return 'moto';
}