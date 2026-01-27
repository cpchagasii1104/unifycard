import type { FastifyReply, FastifyRequest } from 'fastify';
import { availabilityService } from './availability.service';

export class AvailabilityController {
  async setOnline(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as any;
    const data = await availabilityService.setOnline(body);
    return reply.send({ success: true, data });
  }

  async setOffline(req: FastifyRequest, reply: FastifyReply) {
    const { driverId } = req.params as any;
    const data = await availabilityService.setOffline(driverId);
    return reply.send({ success: true, data });
  }

  async setDestinationMode(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as any;
    const data = await availabilityService.setDestinationMode(body);
    return reply.send({ success: true, data });
  }

  async disableDestinationMode(req: FastifyRequest, reply: FastifyReply) {
    const { driverId, tenantId } = req.params as any;
    const data = await availabilityService.disableDestinationMode(driverId, tenantId);
    return reply.send({ success: true, data });
  }

  async getAvailability(req: FastifyRequest, reply: FastifyReply) {
    const { driverId } = req.params as any;
    const data = await availabilityService.getAvailability(driverId);
    return reply.send({ success: true, data });
  }
}

export const availabilityController = new AvailabilityController();
