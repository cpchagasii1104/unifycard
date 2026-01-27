"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ridesModule = void 0;
// import ridesRoutes from './rides.routes'; // TODO: refatorar
// import matchingRoutes from './matching/matching.routes'; // TODO: refatorar
// import pricingRoutes from './pricing/pricing.routes'; // TODO: refatorar
const drivers_routes_1 = __importDefault(require("./drivers/drivers.routes"));
const vehicles_routes_1 = __importDefault(require("./drivers/vehicles/vehicles.routes"));
// import lifecycleRoutes from './lifecycle/lifecycle.routes'; // TODO: refatorar
const location_routes_1 = __importDefault(require("./location/location.routes"));
const availability_routes_1 = __importDefault(require("./availability/availability.routes"));
// import promotionsRoutes from './promotions/promotions.routes'; // TODO: refatorar
// import referralsRoutes from './referrals/referrals.routes'; // TODO: refatorar
const safety_routes_1 = __importDefault(require("./safety/safety.routes"));
const zones_routes_1 = __importDefault(require("./zones/zones.routes"));
const demand_routes_1 = __importDefault(require("./demand/demand.routes"));
const service_types_routes_1 = __importDefault(require("./service-types/service-types.routes"));
const cities_routes_1 = __importDefault(require("./cities/cities.routes"));
const ridesModule = async (fastify) => {
    // await fastify.register(ridesRoutes, { prefix: '/rides' }); // TODO: refatorar
    // await fastify.register(matchingRoutes, { prefix: '/matching' }); // TODO: refatorar
    // await fastify.register(pricingRoutes, { prefix: '/pricing' }); // TODO: refatorar
    await fastify.register(drivers_routes_1.default, { prefix: '/drivers' });
    await fastify.register(vehicles_routes_1.default, { prefix: '/vehicles' });
    // await fastify.register(lifecycleRoutes, { prefix: '/lifecycle' }); // TODO: refatorar
    await fastify.register(location_routes_1.default, { prefix: '/location' });
    await fastify.register(availability_routes_1.default, { prefix: '/availability' });
    // await fastify.register(promotionsRoutes, { prefix: '/promotions' }); // TODO: refatorar
    // await fastify.register(referralsRoutes, { prefix: '/referrals' }); // TODO: refatorar
    await fastify.register(safety_routes_1.default, { prefix: '/safety' });
    await fastify.register(zones_routes_1.default, { prefix: '/zones' });
    await fastify.register(demand_routes_1.default, { prefix: '/demand' });
    await fastify.register(service_types_routes_1.default, { prefix: '/service-types' });
    await fastify.register(cities_routes_1.default, { prefix: '/cities' });
};
exports.ridesModule = ridesModule;
exports.default = ridesModule;
