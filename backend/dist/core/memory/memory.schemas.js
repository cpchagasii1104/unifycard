"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerInteractionSchema = exports.updateFromIntentSchema = void 0;
// src/core/memory/memory.schemas.ts
const zod_1 = require("zod");
exports.updateFromIntentSchema = zod_1.z.object({
    intent: zod_1.z.string().min(1, 'Intent é obrigatória'),
    parameters: zod_1.z.record(zod_1.z.any()),
    entityType: zod_1.z.string().optional(),
    entityId: zod_1.z.string().uuid('ID da entidade inválido').optional(),
    entityName: zod_1.z.string().optional(),
});
exports.registerInteractionSchema = zod_1.z.object({
    entityId: zod_1.z.string().min(1, 'ID da entidade é obrigatório'),
    entityType: zod_1.z.string().min(1, 'Tipo da entidade é obrigatório'),
    entityName: zod_1.z.string().optional(),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
});
