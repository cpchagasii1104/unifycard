/**
 * Multi-leg transport (CD → hub → última milha): decomposição geométrica mínima.
 * P1: heurística sem rotas reais; integração com mapas / rides fica fora.
 */
import type { GeoPoint, TransportDemand, TransportLeg, VehicleType } from './logistics.types';

const CARGO_MULTI_LEG_VOLUME_M3 = 8;

function lerpPoint(a: GeoPoint, b: GeoPoint, t: number): GeoPoint {
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
  };
}

/**
 * Para cargas volumosas, gera cadeia truck → van → moto ao longo do segmento origem–destino.
 * Caso contrário, uma única perna com o veículo já escolhido.
 */
export function buildLegsForDemand(
  demand: TransportDemand,
  matchedVehicle: VehicleType
): TransportLeg[] {
  const { origin, destination, type, volume } = demand;

  const useChain =
    type === 'cargo' && volume >= CARGO_MULTI_LEG_VOLUME_M3 && matchedVehicle === 'truck';

  if (!useChain) {
    return [
      {
        vehicleType: matchedVehicle,
        origin,
        destination,
        sequence: 1,
      },
    ];
  }

  const hub1 = lerpPoint(origin, destination, 1 / 3);
  const hub2 = lerpPoint(origin, destination, 2 / 3);

  return [
    { vehicleType: 'truck', origin, destination: hub1, sequence: 1 },
    { vehicleType: 'van', origin: hub1, destination: hub2, sequence: 2 },
    { vehicleType: 'moto', origin: hub2, destination, sequence: 3 },
  ];
}