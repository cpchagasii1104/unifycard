import type { FastifyRequest, FastifyReply } from 'fastify';
import { vehiclesService } from './vehicles.service';

export class VehiclesController {
  async create(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as any;

    const vehicle = await vehiclesService.createVehicle(body);

    return reply.send({ success: true, data: vehicle });
  }

  async update(req: FastifyRequest, reply: FastifyReply) {
    const tenantId = (req as any).tenant?.id;
    if (!tenantId) throw new Error('Missing tenant context');
    const { vehicleId } = req.params as any;
    const body = req.body as any;

    const vehicle = await vehiclesService.updateVehicle(tenantId, vehicleId, body);

    return reply.send({ success: true, data: vehicle });
  }

  async list(req: FastifyRequest, reply: FastifyReply) {
    const tenantId = (req as any).tenant?.id;
    if (!tenantId) throw new Error('Missing tenant context');
    const { driverId } = req.params as any;

    const list = await vehiclesService.listVehicles(tenantId, driverId);

    return reply.send({ success: true, data: list });
  }

  async getOne(req: FastifyRequest, reply: FastifyReply) {
    const tenantId = (req as any).tenant?.id;
    if (!tenantId) throw new Error('Missing tenant context');
    const { vehicleId } = req.params as any;

    const vehicle = await vehiclesService.getVehicleById(tenantId, vehicleId);

    return reply.send({ success: true, data: vehicle });
  }

  async verify(req: FastifyRequest, reply: FastifyReply) {
    const tenantId = (req as any).tenant?.id;
    if (!tenantId) throw new Error('Missing tenant context');
    const { vehicleId } = req.params as any;
    const { partnerId } = req.body as any;

    const vehicle = await vehiclesService.verifyVehicle(tenantId, vehicleId, partnerId);

    return reply.send({ success: true, data: vehicle });
  }
}

export const vehiclesController = new VehiclesController();
