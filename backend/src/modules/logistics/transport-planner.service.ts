/**
 * Orquestração de plano logístico: demanda → pernas executáveis.
 *
 * Não integra com rides, bank ou BD nesta fase — só decisão estrutural.
 */
import type { TransportDemand, TransportPlan } from './logistics.types';
import { buildLegsForDemand } from './multi-leg.service';
import { transportDemandService } from './transport-demand.service';
import { matchVehicleForDemand } from './vehicle-matcher.service';

const PLANNER_VERSION = 'logistics.transport-planner@0.1.0';

class TransportPlannerService {
  /**
   * Produz um TransportPlan (uma ou N pernas) a partir de atributos de demanda.
   * Cada perna será, no futuro, mapeável para RideRequest / execução no módulo rides.
   */
  planTransport(demand: TransportDemand): TransportPlan {
    transportDemandService.assertValidShape(demand);
    const vehicleType = matchVehicleForDemand(demand);
    const legs = buildLegsForDemand(demand, vehicleType);
    return {
      legs,
      plannerVersion: PLANNER_VERSION,
    };
  }
}

export const transportPlannerService = new TransportPlannerService();

/** Entrada funcional mínima (além da instância `transportPlannerService`). */
export function planTransport(demand: TransportDemand): TransportPlan {
  return transportPlannerService.planTransport(demand);
}