import type { FastifyRequest, FastifyReply } from 'fastify';
import { driversService } from './drivers.service';

export class DriversController {
  async createDriver(req: FastifyRequest, reply: FastifyReply) {
    const tenantId = req.tenant?.id;
    const userId = req.user?.id;
    if (!tenantId || !userId) {
      return reply.status(401).send({ success: false, error: 'Unauthorized' });
    }

    const driver = await driversService.createDriver(tenantId, userId);

    return reply.send({ success: true, data: driver });
  }

  async updateDriver(req: FastifyRequest, reply: FastifyReply) {
    const tenantId = req.tenant?.id;
    const driverId = (req.params as any).driverId;
    const body = req.body as any;

    const updated = await driversService.updateDriver(tenantId!, driverId, body);

    return reply.send({ success: true, data: updated });
  }

  async listDrivers(req: FastifyRequest, reply: FastifyReply) {
    const tenantId = req.tenant?.id;

    const list = await driversService.listDrivers(tenantId!);

    return reply.send({ success: true, data: list });
  }

  async getMyDriverProfile(req: FastifyRequest, reply: FastifyReply) {
    const tenantId = req.tenant?.id;
    const userId = req.user?.id;

    const driver = await driversService.getDriverByUserId(tenantId!, userId!);

    return reply.send({ success: true, data: driver });
  }
}

export const driversController = new DriversController();
// drivers.controller.ts 
