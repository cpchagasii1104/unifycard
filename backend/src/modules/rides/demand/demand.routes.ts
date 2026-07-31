// src/modules/rides/demand/demand.routes.ts
//
// Rotas Fastify para Demand no módulo Rides

// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CONTIDO (schema-ghost fail-closed — F-RIDES-GHOST-CONTAINMENT, 2026-07-31)
// ║ NORMA:   cartório REMEDIATION_DT_LOG.md (topo) — censo endpoint a endpoint desta fatia
// ║ NÃO:     reativar os 4 endpoints deste grupo sem materializar o substrato: a tabela
// ║          rides_zone_demand_pressure (lida pelos 2 GETs via LEFT JOIN), a tabela
// ║          rides_zone_incentives e as funções rides_calculate_zone_pressure /
// ║          rides_create_auto_zone_incentive NÃO existem no schema canônico (medido em
// ║          unificard_dev, 2026-07-31). NÃO criar tabela/função aqui para acomodar o caller.
// ║ EM VEZ:  501 nomeado ANTES de qualquer SQL (padrão automation.routes.ts). Reabrir = frente
// ║          própria que materializa o substrato E remove esta contenção conscientemente
// ║          (guard audit-rides-operational-schema-ghost-containment.mjs morde revival sem isso).
// ╚════════════════════════════════════════════════════════════════

import type {
  FastifyPluginAsync,
  FastifyInstance,
} from 'fastify';

export interface ZoneParams {
  zoneId: string;
}

// Contrato preservado para a futura materialização (frente própria).
export interface CreateIncentiveBody {
  valueCents: number;
  reason?: string;
}

const ghostBody = (missing: string[]) => ({
  ok: false,
  code: 'RIDES_DEMAND_SCHEMA_GHOST_CONTAINED',
  error: 'RIDES_DEMAND_SCHEMA_GHOST_CONTAINED',
  missing_substrate: missing,
  message:
    `Rides demand endpoints are disabled: required substrate does not exist in the canonical schema ` +
    `(${missing.join(', ')}). Reopening requires materializing the substrate via its own governed front ` +
    `(GATE + GO), never by creating tables/functions to fit this caller. No money is moved.`,
});

const demandRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {

  // GET /zones/:zoneId — quebrado em rides_zone_demand_pressure (LEFT JOIN)
  fastify.get<{ Params: ZoneParams }>(
    '/zones/:zoneId',
    { preHandler: [fastify.requirePermission(['rides:demand:read'])] },
    async (_req, reply) =>
      reply.status(501).send(ghostBody(['rides_zone_demand_pressure']))
  );

  // POST /zones/:zoneId/recalculate — quebrado nas funções de pressão/incentivo
  fastify.post<{ Params: ZoneParams }>(
    '/zones/:zoneId/recalculate',
    { preHandler: [fastify.requirePermission(['rides:demand:write'])] },
    async (_req, reply) =>
      reply.status(501).send(ghostBody(['(função) rides_calculate_zone_pressure', '(função) rides_create_auto_zone_incentive']))
  );

  // GET /pressure — quebrado em rides_zone_demand_pressure (LEFT JOIN)
  fastify.get(
    '/pressure',
    { preHandler: [fastify.requirePermission(['rides:demand:read'])] },
    async (_req, reply) =>
      reply.status(501).send(ghostBody(['rides_zone_demand_pressure']))
  );

  // POST /zones/:zoneId/incentives — quebrado em rides_zone_incentives
  fastify.post<{ Params: ZoneParams; Body: CreateIncentiveBody }>(
    '/zones/:zoneId/incentives',
    { preHandler: [fastify.requirePermission(['rides:demand:write'])] },
    async (_req, reply) =>
      reply.status(501).send(ghostBody(['rides_zone_incentives']))
  );
};

export default demandRoutes;
