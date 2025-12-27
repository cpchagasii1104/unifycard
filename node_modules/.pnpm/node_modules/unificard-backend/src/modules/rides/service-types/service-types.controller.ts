// src/modules/rides/service-types/service-types.controller.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { BadRequestError } from '@core/errors';
import { serviceTypesService } from './service-types.service';

export class ServiceTypesController {
  async createServiceType(req: FastifyRequest, reply: FastifyReply) {
    // pega o tenantId decorado pelo tenant plugin
    const tenantId = req.tenant?.id;
    const body = req.body as any;

    if (!tenantId) {
      throw new BadRequestError('Missing tenantId');
    }

    const type = await serviceTypesService.createServiceType(tenantId, body);

    return reply.send({
      success: true,
      data: type,
    });
  }

  async listServiceTypes(req: FastifyRequest, reply: FastifyReply) {
    const tenantId = req.tenant?.id;

    if (!tenantId) {
      throw new BadRequestError('Missing tenantId');
    }

    const types = await serviceTypesService.listServiceTypes(tenantId);

    return reply.send({
      success: true,
      data: types,
    });
  }
}

export const serviceTypesController = new ServiceTypesController();
