import type { FastifyReply, FastifyRequest } from 'fastify';
import { BadRequestError } from '@core/errors';
import { citiesService } from './cities.service';

type CreateCityBody = {
  name: string;
  state: string;
  timezone?: string | null;
  lat?: number | null;
  lng?: number | null;
  base_fare?: number | null;
  min_price?: number | null;
  price_per_km?: number | null;
  price_per_min?: number | null;
  isEnabled?: boolean;
  allows_multi_stop?: boolean;
};

export class CitiesController {
  async createCity(
    req: FastifyRequest<{ Body: CreateCityBody }>,
    reply: FastifyReply
  ) {
    const tenantId = req.tenant?.id;
    if (!tenantId) throw new BadRequestError('Missing tenant context');

    const city = await citiesService.createCity(tenantId, req.body);

    return reply.status(201).send({
      success: true,
      data: city,
    });
  }

  async listCities(req: FastifyRequest, reply: FastifyReply) {
    const tenantId = req.tenant?.id;
    if (!tenantId) throw new BadRequestError('Missing tenant context');

    const cities = await citiesService.listCities(tenantId);

    return reply.send({
      success: true,
      data: cities,
    });
  }
}

export const citiesController = new CitiesController();
