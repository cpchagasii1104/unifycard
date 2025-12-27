"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchCitiesQuerySchema = exports.getCitiesByStateParamsSchema = exports.getStatesByCountryParamsSchema = exports.cityNameSchema = exports.stateCodeSchema = exports.countryCodeSchema = void 0;
// src/core/world/world.schemas.ts
const zod_1 = require("zod");
exports.countryCodeSchema = zod_1.z.string().length(2, 'Código do país deve ter 2 caracteres');
exports.stateCodeSchema = zod_1.z.string().min(1).max(10, 'Código do estado deve ter no máximo 10 caracteres');
exports.cityNameSchema = zod_1.z.string().min(1).max(200, 'Nome da cidade deve ter no máximo 200 caracteres');
exports.getStatesByCountryParamsSchema = zod_1.z.object({
    countryId: zod_1.z.string().uuid('ID do país inválido'),
});
exports.getCitiesByStateParamsSchema = zod_1.z.object({
    stateId: zod_1.z.string().uuid('ID do estado inválido'),
});
exports.searchCitiesQuerySchema = zod_1.z.object({
    term: zod_1.z.string().min(1, 'Termo de busca é obrigatório'),
    countryId: zod_1.z.string().uuid('ID do país inválido').optional(),
    stateId: zod_1.z.string().uuid('ID do estado inválido').optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    offset: zod_1.z.coerce.number().int().min(0).default(0),
});
//# sourceMappingURL=world.schemas.js.map