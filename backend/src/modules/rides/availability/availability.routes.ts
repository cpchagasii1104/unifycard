// ------------------------------------------------------------
// src/modules/rides/availability/availability.routes.ts
// Disponibilidade do motorista — Fastify Unificard v1
// ------------------------------------------------------------

// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CONTIDO (schema-ghost fail-closed — F-RIDES-GHOST-CONTAINMENT, 2026-07-31)
// ║ NORMA:   cartório REMEDIATION_DT_LOG.md (topo) — censo endpoint a endpoint desta fatia
// ║ NÃO:     reativar os 4 endpoints deste grupo sem materializar o substrato: a tabela
// ║          rides_driver_availability e as funções rides_check_driving_limit /
// ║          rides_calculate_realtime_earnings NÃO existem no schema canônico (medido em
// ║          unificard_dev, 2026-07-31). Antes desta contenção, ficar online devolvia 500 cru
// ║          (42P01/42883) com cara de bug de banco. NÃO criar tabela/função aqui para
// ║          acomodar o caller — materializar substrato é frente própria (GATE + GO de Clayton).
// ║ EM VEZ:  501 nomeado ANTES de qualquer service/SQL (padrão automation.routes.ts). Reabrir =
// ║          frente própria que materializa o substrato E remove esta contenção conscientemente
// ║          (guard audit-rides-operational-schema-ghost-containment.mjs morde revival sem isso).
// ╚════════════════════════════════════════════════════════════════

import type {
  FastifyPluginAsync,
  FastifyInstance,
} from 'fastify';

// Contratos preservados para a futura materialização (frente própria).
export interface OnlineBody {
  lat: number;
  lng: number;
  cityId: string;
  vehicleId?: string | null;
}

export interface LocationBody {
  lat: number;
  lng: number;
}

const ghostBody = (missing: string[]) => ({
  ok: false,
  code: 'RIDES_AVAILABILITY_SCHEMA_GHOST_CONTAINED',
  error: 'RIDES_AVAILABILITY_SCHEMA_GHOST_CONTAINED',
  missing_substrate: missing,
  message:
    `Driver availability endpoints are disabled: required substrate does not exist in the canonical schema ` +
    `(${missing.join(', ')}). Reopening requires materializing the substrate via its own governed front ` +
    `(GATE + GO), never by creating tables/functions to fit this caller. No money is moved.`,
});

const availabilityRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {

  // POST /availability/online — quebrado em rides_check_driving_limit (fn) e rides_driver_availability
  fastify.post<{ Body: OnlineBody }>(
    '/online',
    { preHandler: [fastify.requirePermission(['rides:availability:write'])] },
    async (_req, reply) =>
      reply.status(501).send(ghostBody(['(função) rides_check_driving_limit', 'rides_driver_availability']))
  );

  // POST /availability/offline — quebrado em rides_driver_availability
  fastify.post(
    '/offline',
    { preHandler: [fastify.requirePermission(['rides:availability:write'])] },
    async (_req, reply) =>
      reply.status(501).send(ghostBody(['rides_driver_availability']))
  );

  // PATCH /availability/location — quebrado em rides_calculate_realtime_earnings (fn)
  fastify.patch<{ Body: LocationBody }>(
    '/location',
    { preHandler: [fastify.requirePermission(['rides:availability:write'])] },
    async (_req, reply) =>
      reply.status(501).send(ghostBody(['(função) rides_calculate_realtime_earnings']))
  );

  // GET /availability/status — quebrado em rides_driver_availability e rides_calculate_realtime_earnings (fn)
  fastify.get(
    '/status',
    { preHandler: [fastify.requirePermission(['rides:availability:read'])] },
    async (_req, reply) =>
      reply.status(501).send(ghostBody(['rides_driver_availability', '(função) rides_calculate_realtime_earnings']))
  );
};

export default availabilityRoutes;
