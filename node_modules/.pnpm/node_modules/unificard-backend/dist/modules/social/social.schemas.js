"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.feedOptionsSchema = exports.createPostSchema = exports.suggestedActionSchema = exports.mediaItemSchema = void 0;
// src/modules/social/social.schemas.ts
const zod_1 = require("zod");
exports.mediaItemSchema = zod_1.z.object({
    type: zod_1.z.enum(['image', 'video', 'audio']),
    url: zod_1.z.string().url('URL inválida'),
    thumbnailUrl: zod_1.z.string().url('URL de thumbnail inválida').optional(),
    duration: zod_1.z.number().int().min(0, 'Duração deve ser positiva').optional(),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
});
exports.suggestedActionSchema = zod_1.z.object({
    action: zod_1.z.string(),
    module: zod_1.z.string(),
    endpoint: zod_1.z.string().optional(),
    payload: zod_1.z.record(zod_1.z.any()).optional(),
    description: zod_1.z.string(),
});
exports.createPostSchema = zod_1.z.object({
    content: zod_1.z.string().min(1, 'Conteúdo é obrigatório').max(10000, 'Conteúdo deve ter no máximo 10000 caracteres'),
    media: zod_1.z.array(exports.mediaItemSchema).max(10, 'Máximo 10 itens de mídia').optional(),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
    categories: zod_1.z.array(zod_1.z.string().uuid('ID de categoria inválido')).optional(),
    intent: zod_1.z.string().optional(),
});
exports.feedOptionsSchema = zod_1.z.object({
    limit: zod_1.z.number().int().min(1, 'Limit mínimo é 1').max(100, 'Limit máximo é 100').optional(),
    offset: zod_1.z.number().int().min(0, 'Offset mínimo é 0').optional(),
    categoryId: zod_1.z.string().uuid('ID de categoria inválido').optional(),
    intent: zod_1.z.string().optional(),
    userId: zod_1.z.string().uuid('ID do usuário inválido').optional(),
    startDate: zod_1.z.string().datetime('Data de início inválida').optional(),
    endDate: zod_1.z.string().datetime('Data de fim inválida').optional(),
});
//# sourceMappingURL=social.schemas.js.map