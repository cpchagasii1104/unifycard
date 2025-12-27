"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkInSchema = exports.assignStaffSchema = exports.addSessionSchema = exports.createEventSchema = void 0;
// src/modules/events/events.schemas.ts
const zod_1 = require("zod");
exports.createEventSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Título é obrigatório').max(200, 'Título deve ter no máximo 200 caracteres'),
    description: zod_1.z.string().max(5000, 'Descrição deve ter no máximo 5000 caracteres').nullable().optional(),
    startTime: zod_1.z.string().datetime('Data/hora de início inválida').transform((str) => new Date(str)),
    endTime: zod_1.z.string().datetime('Data/hora de fim inválida').transform((str) => new Date(str)),
    cityId: zod_1.z.string().uuid('ID da cidade inválido').nullable().optional(),
    stateId: zod_1.z.string().uuid('ID do estado inválido').nullable().optional(),
    countryId: zod_1.z.string().uuid('ID do país inválido').nullable().optional(),
}).refine((data) => data.endTime > data.startTime, {
    message: 'Data/hora de fim deve ser posterior à data/hora de início',
    path: ['endTime'],
});
exports.addSessionSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Nome é obrigatório').max(200, 'Nome deve ter no máximo 200 caracteres'),
    startTime: zod_1.z.string().datetime('Data/hora de início inválida').transform((str) => new Date(str)),
    endTime: zod_1.z.string().datetime('Data/hora de fim inválida').transform((str) => new Date(str)),
}).refine((data) => data.endTime > data.startTime, {
    message: 'Data/hora de fim deve ser posterior à data/hora de início',
    path: ['endTime'],
});
exports.assignStaffSchema = zod_1.z.object({
    globalUserId: zod_1.z.string().uuid('ID do usuário global inválido'),
    role: zod_1.z.string().min(1, 'Função é obrigatória').max(100, 'Função deve ter no máximo 100 caracteres'),
});
exports.checkInSchema = zod_1.z.object({
// Não precisa de body, apenas do eventId na URL
}).optional();
//# sourceMappingURL=events.schemas.js.map