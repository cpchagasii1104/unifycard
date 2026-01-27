"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.citiesController = exports.CitiesController = void 0;
const errors_1 = require("@core/errors");
const cities_service_1 = require("./cities.service");
class CitiesController {
    async createCity(req, reply) {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const city = await cities_service_1.citiesService.createCity(tenantId, req.body);
        return reply.status(201).send({
            success: true,
            data: city,
        });
    }
    async listCities(req, reply) {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const cities = await cities_service_1.citiesService.listCities(tenantId);
        return reply.send({
            success: true,
            data: cities,
        });
    }
}
exports.CitiesController = CitiesController;
exports.citiesController = new CitiesController();
