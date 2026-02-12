// src/modules/rides/rides/rides.routes.ts
//
// Registro central de todas as rotas do módulo Rides

import type { FastifyInstance } from 'fastify';

import citiesRoutes from '../cities/cities.routes';
import zonesRoutes from '../zones/zones.routes';
import serviceTypesRoutes from '../service-types/service-types.routes';
import driversRoutes from '../drivers/drivers.routes';
import vehiclesRoutes from '../drivers/vehicles/vehicles.routes';
import availabilityRoutes from '../availability/availability.routes';
import locationRoutes from '../location/location.routes';
import safetyRoutes from '../safety/safety.routes';
import demandRoutes from '../demand/demand.routes';
import distributionRoutes from '../distribution/distribution.routes';
import lifecycleRoutes from '../lifecycle/lifecycle.routes';
import matchingRoutes from '../matching/matching.routes';
import pricingRoutes from '../pricing/pricing.routes';
import promotionsRoutes from '../promotions/promotions.routes';
import referralsRoutes from '../referrals/referrals.routes';
import rideRequestsRoutes from '../ride-requests/ride-requests.routes';

export async function ridesRoutes(fastify: FastifyInstance) {
  await fastify.register(citiesRoutes, { prefix: '/rides' });
  await fastify.register(zonesRoutes, { prefix: '/rides' });
  await fastify.register(serviceTypesRoutes, { prefix: '/rides' });
  await fastify.register(driversRoutes, { prefix: '/rides' });
  await fastify.register(vehiclesRoutes, { prefix: '/rides' });
  await fastify.register(availabilityRoutes, { prefix: '/rides' });
  await fastify.register(locationRoutes, { prefix: '/rides' });
  await fastify.register(safetyRoutes, { prefix: '/rides' });
  await fastify.register(demandRoutes, { prefix: '/rides' });
  await fastify.register(distributionRoutes, { prefix: '/rides' });
  await fastify.register(lifecycleRoutes, { prefix: '/rides' });
  await fastify.register(matchingRoutes, { prefix: '/rides' });
  await fastify.register(pricingRoutes, { prefix: '/rides' });
  await fastify.register(promotionsRoutes, { prefix: '/rides' });
  await fastify.register(referralsRoutes, { prefix: '/rides' });
  await fastify.register(rideRequestsRoutes, { prefix: '/rides' });
}
