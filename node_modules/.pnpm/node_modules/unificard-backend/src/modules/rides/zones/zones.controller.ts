import { zonesService } from './zones.service';
import type { FastifyRequest, FastifyReply } from 'fastify';

export class ZonesController {
  async createZone(req: FastifyRequest, reply: FastifyReply) {
    const tenantId = (req as any).tenant?.id;
    if (!tenantId) throw new Error('Missing tenant context');
    const body = req.body as any;
    const { cityId } = body;

    const zone = await zonesService.createZone(tenantId, cityId, body);

    return reply.send({
      success: true,
      data: zone
    });
  }

  async listZones(req: FastifyRequest, reply: FastifyReply) {
    const tenantId = (req as any).tenant?.id;
    if (!tenantId) throw new Error('Missing tenant context');
    const cityId = (req.query as any).cityId;

    const zones = await zonesService.listZonesByCity(tenantId, cityId);

    return reply.send({
      success: true,
      data: zones
    });
  }
}

export const zonesController = new ZonesController();
// zones.controller.ts 
