"use strict";
// src/modules/rides/rides/rides.routes.ts
//
// Registro central de todas as rotas do módulo Rides
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ridesRoutes = ridesRoutes;
const cities_routes_1 = __importDefault(require("../cities/cities.routes"));
const zones_routes_1 = __importDefault(require("../zones/zones.routes"));
const service_types_routes_1 = __importDefault(require("../service-types/service-types.routes"));
const drivers_routes_1 = __importDefault(require("../drivers/drivers.routes"));
const vehicles_routes_1 = __importDefault(require("../drivers/vehicles/vehicles.routes"));
const availability_routes_1 = __importDefault(require("../availability/availability.routes"));
const location_routes_1 = __importDefault(require("../location/location.routes"));
const safety_routes_1 = __importDefault(require("../safety/safety.routes"));
const demand_routes_1 = __importDefault(require("../demand/demand.routes"));
const distribution_routes_1 = __importDefault(require("../distribution/distribution.routes"));
const lifecycle_routes_1 = __importDefault(require("../lifecycle/lifecycle.routes"));
const matching_routes_1 = __importDefault(require("../matching/matching.routes"));
const pricing_routes_1 = __importDefault(require("../pricing/pricing.routes"));
const promotions_routes_1 = __importDefault(require("../promotions/promotions.routes"));
const referrals_routes_1 = __importDefault(require("../referrals/referrals.routes"));
const ride_requests_routes_1 = __importDefault(require("../ride-requests/ride-requests.routes"));
async function ridesRoutes(fastify) {
    await fastify.register(cities_routes_1.default, { prefix: '/rides' });
    await fastify.register(zones_routes_1.default, { prefix: '/rides' });
    await fastify.register(service_types_routes_1.default, { prefix: '/rides' });
    await fastify.register(drivers_routes_1.default, { prefix: '/rides' });
    await fastify.register(vehicles_routes_1.default, { prefix: '/rides' });
    await fastify.register(availability_routes_1.default, { prefix: '/rides' });
    await fastify.register(location_routes_1.default, { prefix: '/rides' });
    await fastify.register(safety_routes_1.default, { prefix: '/rides' });
    await fastify.register(demand_routes_1.default, { prefix: '/rides' });
    await fastify.register(distribution_routes_1.default, { prefix: '/rides' });
    await fastify.register(lifecycle_routes_1.default, { prefix: '/rides' });
    await fastify.register(matching_routes_1.default, { prefix: '/rides' });
    await fastify.register(pricing_routes_1.default, { prefix: '/rides' });
    await fastify.register(promotions_routes_1.default, { prefix: '/rides' });
    await fastify.register(referrals_routes_1.default, { prefix: '/rides' });
    await fastify.register(ride_requests_routes_1.default, { prefix: '/rides' });
}
//# sourceMappingURL=rides.routes.js.map