import type { FastifyRequest, FastifyReply } from 'fastify';
import { locationService } from './location.service';

export class LocationController {
  async update(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as any;
    const result = await locationService.updateLocation(body);
    return reply.send({ success: true, data: result });
  }

  async distance(req: FastifyRequest, reply: FastifyReply) {
    const { lat1, lng1, lat2, lng2 } = req.query as any;

    const distance = await locationService.calculateDistanceMeters(
      Number(lat1),
      Number(lng1),
      Number(lat2),
      Number(lng2),
    );

    const eta = await locationService.calculateETASeconds(distance);

    return reply.send({
      success: true,
      distance_meters: distance,
      eta_seconds: eta,
    });
  }
}

export const locationController = new LocationController();
