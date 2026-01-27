"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setResidencePreferencesSchema = exports.setResidenceSchema = void 0;
// src/core/residence/residence.schemas.ts
const zod_1 = require("zod");
exports.setResidenceSchema = zod_1.z.object({
    countryId: zod_1.z.string().uuid('ID do país inválido').nullable().optional(),
    stateId: zod_1.z.string().uuid('ID do estado inválido').nullable().optional(),
    cityId: zod_1.z.string().uuid('ID da cidade inválida').nullable().optional(),
    timezone: zod_1.z.string().max(100, 'Timezone deve ter no máximo 100 caracteres').nullable().optional(),
    currency: zod_1.z.string().length(3, 'Moeda deve ter 3 caracteres (ISO 4217)').optional(),
    languages: zod_1.z.array(zod_1.z.string().min(2).max(10, 'Código de idioma inválido')).optional(),
});
exports.setResidencePreferencesSchema = zod_1.z.object({
    timezone: zod_1.z.string().max(100, 'Timezone deve ter no máximo 100 caracteres').nullable().optional(),
    currency: zod_1.z.string().length(3, 'Moeda deve ter 3 caracteres (ISO 4217)').optional(),
    languages: zod_1.z.array(zod_1.z.string().min(2).max(10, 'Código de idioma inválido')).optional(),
});
