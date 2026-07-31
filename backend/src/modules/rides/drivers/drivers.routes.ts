// src/modules/rides/drivers/drivers.routes.ts
//
// Rotas Fastify para o módulo de Motoristas (Rides)

import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply
} from 'fastify';

import { runQueryWithTenant } from '@core/db';
import { BadRequestError, NotFoundError } from '@core/errors';
import { driversService } from './drivers.service';

interface DriverParams {
  driverId: string;
}

interface CreateDriverBody {
  fullName?: string;
}

// Contrato preservado para a futura materialização (frente própria).
export interface UpdateAvailabilityBody {
  isAvailable: boolean;
}

// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  PARCIALMENTE CONTIDO (F-RIDES-GHOST-CONTAINMENT, 2026-07-31)
// ║ NORMA:   cartório REMEDIATION_DT_LOG.md (topo) — censo endpoint a endpoint desta fatia
// ║ NÃO:     reativar PATCH /:driverId/availability sem materializar rides_driver_availability
// ║          (NÃO existe no schema canônico, medido em unificard_dev 2026-07-31). Os outros 3
// ║          endpoints (GET /, GET /:driverId, POST /) usam rides_drivers, que EXISTE — seguem
// ║          vivos, não contenha o grupo inteiro. NÃO criar a tabela aqui.
// ║ EM VEZ:  501 nomeado ANTES de qualquer SQL no endpoint quebrado (padrão automation.routes.ts).
// ║          Reabrir = frente própria que materializa o substrato E remove esta contenção
// ║          (guard audit-rides-operational-schema-ghost-containment.mjs).
// ╚════════════════════════════════════════════════════════════════
const DRIVER_AVAILABILITY_GHOST_BODY = {
  ok: false,
  code: 'RIDES_AVAILABILITY_SCHEMA_GHOST_CONTAINED',
  error: 'RIDES_AVAILABILITY_SCHEMA_GHOST_CONTAINED',
  missing_substrate: ['rides_driver_availability'],
  message:
    'Driver availability flag endpoint is disabled: table rides_driver_availability does not exist in the ' +
    'canonical schema. Reopening requires materializing the substrate via its own governed front (GATE + GO). ' +
    'No money is moved.',
} as const;

const driversRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {

  // =====================================================================
  // GET /drivers — lista motoristas do tenant
  // =====================================================================
  fastify.get(
    '/',
    {
      preHandler: [fastify.requirePermission(['rides:drivers:read'])],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const drivers = await driversService.listDrivers(tenantId);
      return drivers;
    }
  );

  // =====================================================================
  // GET /drivers/:driverId — detalhes de um motorista
  // =====================================================================
  fastify.get<{ Params: DriverParams }>(
    '/:driverId',
    {
      preHandler: [fastify.requirePermission(['rides:drivers:read'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const { driverId } = req.params;

      const row = await runQueryWithTenant<{
        driver_id: string;
        user_id: string;
        status: string;
        level: string;
        active_vehicle_id: string | null;
        created_at: Date;
        updated_at: Date;
      }>(tenantId, {
        text: `
          SELECT
            driver_id,
            user_id,
            status,
            level,
            active_vehicle_id,
            created_at,
            updated_at
          FROM rides_drivers
          WHERE tenant_id = $1 AND driver_id = $2;
        `,
        values: [tenantId, driverId],
      });

      if (!row) {
        throw new NotFoundError('Driver not found');
      }

      return {
        driver_id: row.driver_id,
        user_id: row.user_id,
        status: row.status,
        level: row.level,
        active_vehicle_id: row.active_vehicle_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }
  );

  // =====================================================================
  // POST /drivers — cria perfil de motorista
  // =====================================================================
  fastify.post<{ Body: CreateDriverBody }>(
    '/',
    {
      preHandler: [fastify.requirePermission(['rides:drivers:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      const userId = req.user?.id;

      if (!tenantId) throw new BadRequestError('Missing tenant context');
      if (!userId) throw new BadRequestError('Missing authenticated user');

      const driver = await driversService.createDriver(tenantId, userId);

      reply.code(201);
      return driver;
    }
  );

  // =====================================================================
  // PATCH /drivers/:driverId/availability — muda status de disponibilidade
  // =====================================================================
  // CONTIDO — substrato rides_driver_availability ausente (ver migalha no topo).
  fastify.patch<{ Params: DriverParams; Body: UpdateAvailabilityBody }>(
    '/:driverId/availability',
    {
      preHandler: [fastify.requirePermission(['rides:drivers:write'])],
    },
    async (_req, reply) => reply.status(501).send(DRIVER_AVAILABILITY_GHOST_BODY)
  );
};

export default driversRoutes;
