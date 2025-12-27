// src/modules/rides/rides.module.ts
import { FastifyPluginAsync } from 'fastify';
// import ridesRoutes from './rides.routes'; // TODO: refatorar
// import matchingRoutes from './matching/matching.routes'; // TODO: refatorar
// import pricingRoutes from './pricing/pricing.routes'; // TODO: refatorar
import driversRoutes from './drivers/drivers.routes';
import vehiclesRoutes from './drivers/vehicles/vehicles.routes';
// import lifecycleRoutes from './lifecycle/lifecycle.routes'; // TODO: refatorar
import locationRoutes from './location/location.routes';
import availabilityRoutes from './availability/availability.routes';
// import promotionsRoutes from './promotions/promotions.routes'; // TODO: refatorar
// import referralsRoutes from './referrals/referrals.routes'; // TODO: refatorar
import safetyRoutes from './safety/safety.routes';
import zonesRoutes from './zones/zones.routes';
import demandRoutes from './demand/demand.routes';
import serviceTypesRoutes from './service-types/service-types.routes';
import citiesRoutes from './cities/cities.routes';

const ridesModule: FastifyPluginAsync = async (fastify) => {
  // await fastify.register(ridesRoutes, { prefix: '/rides' }); // TODO: refatorar
  // await fastify.register(matchingRoutes, { prefix: '/matching' }); // TODO: refatorar
  // await fastify.register(pricingRoutes, { prefix: '/pricing' }); // TODO: refatorar
  await fastify.register(driversRoutes, { prefix: '/drivers' });
  await fastify.register(vehiclesRoutes, { prefix: '/vehicles' });
  // await fastify.register(lifecycleRoutes, { prefix: '/lifecycle' }); // TODO: refatorar
  await fastify.register(locationRoutes, { prefix: '/location' });
  await fastify.register(availabilityRoutes, { prefix: '/availability' });
  // await fastify.register(promotionsRoutes, { prefix: '/promotions' }); // TODO: refatorar
  // await fastify.register(referralsRoutes, { prefix: '/referrals' }); // TODO: refatorar
  await fastify.register(safetyRoutes, { prefix: '/safety' });
  await fastify.register(zonesRoutes, { prefix: '/zones' });
  await fastify.register(demandRoutes, { prefix: '/demand' });
  await fastify.register(serviceTypesRoutes, { prefix: '/service-types' });
  await fastify.register(citiesRoutes, { prefix: '/cities' });
};

export default ridesModule;
