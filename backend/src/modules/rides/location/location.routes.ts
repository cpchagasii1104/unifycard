// src/modules/rides/location/location.routes.ts
//
// Rotas Fastify para localização no módulo Rides

import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply
} from 'fastify';

import { locationService } from './location.service';

// Contrato preservado para a futura materialização (frente própria).
export interface UpdateLocationBody {
  driverId: string;
  lat: number;
  lng: number;
}

// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  PARCIALMENTE CONTIDO (F-RIDES-GHOST-CONTAINMENT, 2026-07-31)
// ║ NORMA:   cartório REMEDIATION_DT_LOG.md (topo) — censo endpoint a endpoint desta fatia
// ║ NÃO:     reativar POST /drivers/location sem materializar o substrato da cadeia que ele
// ║          dispara (locationService.updateLocation → availabilityService.isOnline →
// ║          rides_driver_availability AUSENTE; depois rides_check_driving_limit e
// ║          rides_calculate_realtime_earnings, funções AUSENTES; medido em unificard_dev
// ║          2026-07-31). GET /location/distance é matemática pura (Haversine, zero SQL) —
// ║          segue vivo, não contenha o grupo inteiro. NÃO criar tabela/função aqui.
// ║ EM VEZ:  501 nomeado ANTES do service no endpoint quebrado (padrão automation.routes.ts).
// ║          Reabrir = frente própria que materializa o substrato E remove esta contenção
// ║          (guard audit-rides-operational-schema-ghost-containment.mjs).
// ╚════════════════════════════════════════════════════════════════
const LOCATION_GHOST_BODY = {
  ok: false,
  code: 'RIDES_LOCATION_SCHEMA_GHOST_CONTAINED',
  error: 'RIDES_LOCATION_SCHEMA_GHOST_CONTAINED',
  missing_substrate: [
    'rides_driver_availability',
    '(função) rides_check_driving_limit',
    '(função) rides_calculate_realtime_earnings',
    '(função) rides_calculate_zone_pressure',
  ],
  message:
    'MODULE OUT OF PRODUCT MINIMUM (owner decision, 2026-08-01): rides is not one of the seven ' +
    'verticals of the minimum (rede social · banco · cartão · compra/venda · locação · ingressos/shows/' +
    'eventos · serviços). This is NOT broken and NOT technical debt — it is scope not started. The absent ' +
    'substrate below is the secondary reason, and it does NOT expire this containment: even once the ' +
    'substrate exists, reopening still requires the owner to bring rides into the product minimum. ' +
    'Driver location ping is disabled: its chain requires substrate that does not exist in the canonical ' +
    'schema (rides_driver_availability; functions rides_check_driving_limit, rides_calculate_realtime_earnings, ' +
    'rides_calculate_zone_pressure). Reopening requires materializing the substrate via its own governed front ' +
    '(GATE + GO). No money is moved.',
} as const;

interface DistanceQuery {
  lat1: string;
  lng1: string;
  lat2: string;
  lng2: string;
}

const locationRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {

  // =====================================================================
  // POST /drivers/location — receber ping de localização
  // =====================================================================
  // CONTIDO — cadeia depende de substrato ausente (ver migalha no topo).
  fastify.post<{ Body: UpdateLocationBody }>(
    '/drivers/location',
    {
      preHandler: [fastify.requirePermission(['rides:location:write'])],
    },
    async (_req, reply) => reply.status(501).send(LOCATION_GHOST_BODY)
  );

  // =====================================================================
  // GET /location/distance — calcular distância/ETA
  // =====================================================================
  fastify.get<{ Querystring: DistanceQuery }>(
    '/location/distance',
    {
      preHandler: [fastify.requirePermission(['rides:location:read'])],
    },
    async (req, reply) => {
      const { lat1, lng1, lat2, lng2 } = req.query;

      const distance = await locationService.calculateDistanceMeters(
        Number(lat1),
        Number(lng1),
        Number(lat2),
        Number(lng2),
      );

      const eta = await locationService.calculateETASeconds(distance);

      return {
        distance_meters: distance,
        eta_seconds: eta,
      };
    }
  );
};

export default locationRoutes;
