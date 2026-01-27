"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setCurrencySchema = exports.setTimezoneSchema = exports.setLanguagesSchema = exports.setRegionSchema = exports.updateRootConfigSchema = void 0;
// src/core/root-config/root-config.schemas.ts
const zod_1 = require("zod");
exports.updateRootConfigSchema = zod_1.z.object({
    countryId: zod_1.z.string().uuid('ID do país inválido').nullable().optional(),
    stateId: zod_1.z.string().uuid('ID do estado inválido').nullable().optional(),
    cityId: zod_1.z.string().uuid('ID da cidade inválida').nullable().optional(),
    timezone: zod_1.z.string().max(100, 'Timezone deve ter no máximo 100 caracteres').nullable().optional(),
    currency: zod_1.z.string().length(3, 'Moeda deve ter 3 caracteres (ISO 4217)').nullable().optional(),
    languages: zod_1.z.array(zod_1.z.string().min(2).max(10, 'Código de idioma inválido')).optional(),
});
exports.setRegionSchema = zod_1.z.object({
    countryId: zod_1.z.string().uuid('ID do país inválido').nullable().optional(),
    stateId: zod_1.z.string().uuid('ID do estado inválido').nullable().optional(),
    cityId: zod_1.z.string().uuid('ID da cidade inválida').nullable().optional(),
});
exports.setLanguagesSchema = zod_1.z.object({
    languages: zod_1.z.array(zod_1.z.string().min(2).max(10, 'Código de idioma inválido')).min(1, 'Pelo menos um idioma é obrigatório'),
});
exports.setTimezoneSchema = zod_1.z.object({
    timezone: zod_1.z.string().max(100, 'Timezone deve ter no máximo 100 caracteres').min(1, 'Timezone é obrigatório'),
});
exports.setCurrencySchema = zod_1.z.object({
    currency: zod_1.z.string().length(3, 'Moeda deve ter 3 caracteres (ISO 4217)').min(1, 'Moeda é obrigatória'),
});
