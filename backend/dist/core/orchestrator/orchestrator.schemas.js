"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.flowStepSchema = exports.suggestedActionSchema = exports.categoryMatchSchema = exports.intentAnalysisSchema = exports.executeIntentSchema = exports.analyzeTextSchema = void 0;
// src/core/orchestrator/orchestrator.schemas.ts
const zod_1 = require("zod");
const intentTypeSchema = zod_1.z.enum([
    'hire_service',
    'buy_product',
    'request_ride',
    'book_event',
    'schedule_service',
    'order_food',
    'delivery_pickup',
    'search_local',
    'post_content',
    'ask_question',
    'support',
]);
const targetModuleSchema = zod_1.z.enum([
    'work',
    'events',
    'rides',
    'marketplace',
    'commerce',
    'delivery',
    'identity',
    'categories',
    'orchestrator',
]);
exports.analyzeTextSchema = zod_1.z.object({
    text: zod_1.z.string().min(1, 'Texto é obrigatório').max(10000, 'Texto deve ter no máximo 10000 caracteres'),
    audioUrl: zod_1.z.string().url('URL de áudio inválida').optional(),
    context: zod_1.z.object({
        location: zod_1.z.object({
            latitude: zod_1.z.number().min(-90).max(90),
            longitude: zod_1.z.number().min(-180).max(180),
            cityId: zod_1.z.string().uuid('ID da cidade inválido').optional(),
        }).optional(),
        previousIntent: intentTypeSchema.optional(),
        userId: zod_1.z.string().uuid('ID do usuário inválido').optional(),
    }).optional(),
});
exports.executeIntentSchema = zod_1.z.object({
    intent: intentTypeSchema,
    parameters: zod_1.z.record(zod_1.z.any()),
    targetModule: targetModuleSchema.optional(),
    userId: zod_1.z.string().uuid('ID do usuário inválido'),
    tenantId: zod_1.z.string().uuid('ID do tenant inválido'),
});
exports.intentAnalysisSchema = zod_1.z.object({
    intent: intentTypeSchema,
    confidence: zod_1.z.number().min(0).max(1),
    parameters: zod_1.z.record(zod_1.z.any()).optional(),
    reasoning: zod_1.z.string().optional(),
});
exports.categoryMatchSchema = zod_1.z.object({
    categoryId: zod_1.z.string().uuid(),
    categoryName: zod_1.z.string(),
    categoryPath: zod_1.z.array(zod_1.z.string()),
    relevance: zod_1.z.number().min(0).max(1),
});
exports.suggestedActionSchema = zod_1.z.object({
    action: zod_1.z.string(),
    module: targetModuleSchema,
    endpoint: zod_1.z.string().optional(),
    payload: zod_1.z.record(zod_1.z.any()).optional(),
    description: zod_1.z.string(),
});
exports.flowStepSchema = zod_1.z.object({
    step: zod_1.z.number().int().min(1),
    module: targetModuleSchema,
    action: zod_1.z.string(),
    description: zod_1.z.string(),
    required: zod_1.z.boolean().optional(),
});
//# sourceMappingURL=orchestrator.schemas.js.map