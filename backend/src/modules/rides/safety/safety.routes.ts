// src/modules/rides/safety/safety.routes.ts
//
// Rotas Fastify para segurança no módulo Rides

// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CONTIDO (schema-ghost fail-closed — F-RIDES-GHOST-CONTAINMENT, 2026-07-31)
// ║ NORMA:   cartório REMEDIATION_DT_LOG.md (topo) — censo endpoint a endpoint desta fatia
// ║ NÃO:     reativar os 5 endpoints deste grupo sem materializar o substrato: as tabelas
// ║          rides_emergency_contacts, rides_ride_events, rides_ride_shares, rides_disputes e
// ║          notify_queue NÃO existem no schema canônico (medido em unificard_dev, 2026-07-31).
// ║          notify_queue é contido AQUI na borda (as rotas que alcançam o notificador), não
// ║          dentro do notify.service — mexer no notificador é frente própria (plataforma de
// ║          notificação unificada). NÃO criar tabela aqui para acomodar o caller.
// ║          Obs.: rides_safety_alerts (citada no censo da direção) NÃO é escrita por estas
// ║          rotas — só por safety.service.ts, que é INALCANÇÁVEL (importado apenas por
// ║          safety.controller.ts, que nada importa).
// ║ EM VEZ:  501 nomeado ANTES de qualquer service/SQL/notify (padrão automation.routes.ts).
// ║          Reabrir = frente própria que materializa o substrato E remove esta contenção
// ║          conscientemente (guard audit-rides-operational-schema-ghost-containment.mjs).
// ╚════════════════════════════════════════════════════════════════

import type {
  FastifyPluginAsync,
  FastifyInstance,
} from 'fastify';

// Contratos preservados para a futura materialização (frente própria).
export interface CreateContactBody {
  name: string;
  phone: string;
}

export interface SOSBody {
  rideId: string;
  lat: number;
  lng: number;
  type: 'passenger' | 'driver';
  message?: string;
}

export interface ShareRideBody {
  rideId: string;
  contactIds: string[];
}

export interface ReportIncidentBody {
  rideId: string;
  type: string;
  description?: string;
}

const ghostBody = (missing: string[]) => ({
  ok: false,
  code: 'RIDES_SAFETY_SCHEMA_GHOST_CONTAINED',
  error: 'RIDES_SAFETY_SCHEMA_GHOST_CONTAINED',
  missing_substrate: missing,
  message:
    `Rides safety endpoints are disabled: required substrate does not exist in the canonical schema ` +
    `(${missing.join(', ')}). Reopening requires materializing the substrate via its own governed front ` +
    `(GATE + GO), never by creating tables to fit this caller. No money is moved.`,
});

const safetyRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {

  // GET /contacts — quebrado em rides_emergency_contacts
  fastify.get(
    '/contacts',
    { preHandler: [fastify.requirePermission(['rides:safety:read'])] },
    async (_req, reply) =>
      reply.status(501).send(ghostBody(['rides_emergency_contacts']))
  );

  // POST /contacts — quebrado em rides_emergency_contacts
  fastify.post<{ Body: CreateContactBody }>(
    '/contacts',
    { preHandler: [fastify.requirePermission(['rides:safety:write'])] },
    async (_req, reply) =>
      reply.status(501).send(ghostBody(['rides_emergency_contacts']))
  );

  // POST /sos — quebrado em rides_ride_events, rides_emergency_contacts e notify_queue (borda do notificador)
  fastify.post<{ Body: SOSBody }>(
    '/sos',
    { preHandler: [fastify.requirePermission(['rides:safety:write'])] },
    async (_req, reply) =>
      reply.status(501).send(ghostBody(['rides_ride_events', 'rides_emergency_contacts', 'notify_queue']))
  );

  // POST /share — quebrado em rides_ride_shares, rides_emergency_contacts e notify_queue (borda do notificador)
  fastify.post<{ Body: ShareRideBody }>(
    '/share',
    { preHandler: [fastify.requirePermission(['rides:safety:write'])] },
    async (_req, reply) =>
      reply.status(501).send(ghostBody(['rides_ride_shares', 'rides_emergency_contacts', 'notify_queue']))
  );

  // POST /incident — quebrado em rides_disputes
  fastify.post<{ Body: ReportIncidentBody }>(
    '/incident',
    { preHandler: [fastify.requirePermission(['rides:safety:write'])] },
    async (_req, reply) =>
      reply.status(501).send(ghostBody(['rides_disputes']))
  );
};

export default safetyRoutes;
