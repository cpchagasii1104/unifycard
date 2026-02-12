// backend/src/modules/rides/demand/demand.controller.ts

import type { FastifyRequest, FastifyReply } from 'fastify';
import { demandService } from './demand.service';

/**
 * Controller de demanda do módulo Rides.
 *
 * Usa o serviço `demandService.calculateZonePressure` para calcular
 * a pressão de demanda de uma zona específica.
 */
export class DemandController {
  async recalculateZonePressure(req: FastifyRequest, reply: FastifyReply) {
    const { zoneId } = req.params as any;
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return reply.status(401).send({ error: 'Tenant not found' });
    }

    const pressure = await demandService.calculateZonePressure(tenantId, String(zoneId));

    return reply.send({
      success: true,
      data: {
        zoneId,
        pressure,
      },
    });
  }
}

export const demandController = new DemandController();
