// src/modules/rides/service-types/service-types.routes.ts
//
// Rotas Fastify para tipos de serviço no módulo Rides

import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply
} from 'fastify';

import { BadRequestError } from '@core/errors';
import { serviceTypesService } from './service-types.service';

// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  PARCIALMENTE CONTIDO (F-RIDES-GHOST-CONTAINMENT, 2026-07-31)
// ║ NORMA:   cartório REMEDIATION_DT_LOG.md (topo) — censo endpoint a endpoint desta fatia
// ║ NÃO:     reativar GET/POST /:id/drivers sem materializar rides_driver_services (NÃO existe
// ║          no schema canônico, medido em unificard_dev 2026-07-31). Os outros 5 endpoints
// ║          (CRUD de rides_service_types, que EXISTE) seguem vivos — não contenha o grupo
// ║          inteiro. NÃO criar a tabela aqui para acomodar o caller.
// ║ EM VEZ:  501 nomeado ANTES de qualquer SQL nos endpoints quebrados (padrão
// ║          automation.routes.ts). Reabrir = frente própria que materializa o substrato E
// ║          remove esta contenção (guard audit-rides-operational-schema-ghost-containment.mjs).
// ╚════════════════════════════════════════════════════════════════
const DRIVER_SERVICES_GHOST_BODY = {
  ok: false,
  code: 'RIDES_DRIVER_SERVICES_SCHEMA_GHOST_CONTAINED',
  error: 'RIDES_DRIVER_SERVICES_SCHEMA_GHOST_CONTAINED',
  missing_substrate: ['rides_driver_services'],
  message:
    'MODULE OUT OF PRODUCT MINIMUM (owner decision, 2026-08-01): rides is not one of the seven ' +
    'verticals of the minimum (rede social · banco · cartão · compra/venda · locação · ingressos/shows/' +
    'eventos · serviços). This is NOT broken and NOT technical debt — it is scope not started. The absent ' +
    'substrate below is the secondary reason, and it does NOT expire this containment: even once the ' +
    'substrate exists, reopening still requires the owner to bring rides into the product minimum. ' +
    'Driver↔service-type link endpoints are disabled: table rides_driver_services does not exist in the ' +
    'canonical schema. Reopening requires materializing the substrate via its own governed front (GATE + GO). ' +
    'No money is moved.',
} as const;

interface ServiceTypeParams {
  id: string;
}

interface CreateServiceTypeBody {
  name: string;
  description?: string;
  capacity: number;
  baseMultiplier?: number;
  iconUrl?: string;
}

interface UpdateServiceTypeBody {
  name?: string;
  description?: string;
  capacity?: number;
  baseMultiplier?: number;
  isActive?: boolean;
  iconUrl?: string;
}

const serviceTypesRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {

  // =====================================================================
  // GET /service-types — lista tipos de serviço ativos
  // =====================================================================
  fastify.get(
    '/',
    {
      preHandler: [fastify.requirePermission(['rides:service-types:read'])],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const serviceTypes = await serviceTypesService.listServiceTypes(tenantId);
      return serviceTypes;
    }
  );

  // =====================================================================
  // GET /service-types/:id — detalhes de um tipo de serviço
  // =====================================================================
  fastify.get<{ Params: ServiceTypeParams }>(
    '/:id',
    {
      preHandler: [fastify.requirePermission(['rides:service-types:read'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const { id } = req.params;
      const serviceType = await serviceTypesService.getServiceType(tenantId, id);
      return serviceType;
    }
  );

  // =====================================================================
  // POST /service-types — criar tipo de serviço (admin)
  // =====================================================================
  fastify.post<{ Body: CreateServiceTypeBody }>(
    '/',
    {
      preHandler: [fastify.requirePermission(['rides:service-types:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const { name, description, capacity, baseMultiplier, iconUrl } = req.body;

      if (!name) throw new BadRequestError('name required');
      if (!capacity) throw new BadRequestError('capacity required');

      const serviceType = await serviceTypesService.createServiceType(tenantId, {
        name,
        description,
        capacity,
        base_fare: null,
        min_fare: null,
        price_per_km: null,
        price_per_min: null,
        capacity_min: capacity,
        capacity_max: capacity,
        is_luxury: false,
        is_motorcycle: false,
        is_cargo: false,
        icon_url: iconUrl,
        image_url: null,
        base_multiplier: baseMultiplier ?? 1.0,
      });

      reply.code(201);
      return serviceType;
    }
  );

  // =====================================================================
  // PATCH /service-types/:id — atualizar tipo de serviço
  // =====================================================================
  fastify.patch<{ Params: ServiceTypeParams; Body: UpdateServiceTypeBody }>(
    '/:id',
    {
      preHandler: [fastify.requirePermission(['rides:service-types:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const { id } = req.params;
      const patch = req.body;

      const serviceType = await serviceTypesService.updateServiceType(tenantId, id, {
        name: patch.name,
        description: patch.description,
        capacity_min: patch.capacity,
        capacity_max: patch.capacity,
        base_multiplier: patch.baseMultiplier,
        is_active: patch.isActive,
        icon_url: patch.iconUrl,
      });

      return serviceType;
    }
  );

  // =====================================================================
  // DELETE /service-types/:id — soft delete (is_active = false)
  // =====================================================================
  fastify.delete<{ Params: ServiceTypeParams }>(
    '/:id',
    {
      preHandler: [fastify.requirePermission(['rides:service-types:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const { id } = req.params;
      await serviceTypesService.deleteServiceType(tenantId, id);
      return { ok: true };
    }
  );

  // =====================================================================
  // GET /service-types/:id/drivers — lista motoristas que suportam esse tipo
  // =====================================================================
  fastify.get<{ Params: ServiceTypeParams }>(
    '/:id/drivers',
    {
      preHandler: [fastify.requirePermission(['rides:service-types:read'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      return reply.status(501).send(DRIVER_SERVICES_GHOST_BODY);
    }
  );

  // =====================================================================
  // POST /service-types/:id/drivers — permite motorista habilitar um serviço
  // =====================================================================
  fastify.post<{ Params: ServiceTypeParams }>(
    '/:id/drivers',
    {
      preHandler: [fastify.requirePermission(['rides:service-types:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      const userId = req.user?.id;
      if (!tenantId || !userId) throw new BadRequestError('Missing tenant or user context');

      return reply.status(501).send(DRIVER_SERVICES_GHOST_BODY);
    }
  );
};

export default serviceTypesRoutes;

