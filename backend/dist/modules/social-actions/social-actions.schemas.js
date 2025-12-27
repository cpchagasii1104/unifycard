"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.actionStatusSchema = exports.executeActionSchema = exports.createActionSchema = void 0;
// src/modules/social-actions/social-actions.schemas.ts
const zod_1 = require("zod");
exports.createActionSchema = zod_1.z.object({
    postId: zod_1.z.string().uuid('ID do post inválido'),
    intent: zod_1.z.string().min(1, 'Intent é obrigatória'),
    confidence: zod_1.z.number().min(0).max(1, 'Confiança deve estar entre 0 e 1').optional(),
    parameters: zod_1.z.record(zod_1.z.any()),
});
exports.executeActionSchema = zod_1.z.object({
    actionId: zod_1.z.string().uuid('ID da ação inválido'),
});
exports.actionStatusSchema = zod_1.z.enum(['available', 'executed', 'failed', 'cancelled']);
//# sourceMappingURL=social-actions.schemas.js.map