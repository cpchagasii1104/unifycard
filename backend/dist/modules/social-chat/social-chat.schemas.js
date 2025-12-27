"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMessageSchema = exports.mediaItemSchema = void 0;
// src/modules/social-chat/social-chat.schemas.ts
const zod_1 = require("zod");
exports.mediaItemSchema = zod_1.z.object({
    type: zod_1.z.enum(['image', 'video', 'audio']),
    url: zod_1.z.string().url('URL inválida'),
    thumbnailUrl: zod_1.z.string().url('URL de thumbnail inválida').optional(),
    duration: zod_1.z.number().int().min(0, 'Duração deve ser positiva').optional(),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
});
exports.sendMessageSchema = zod_1.z.object({
    conversationId: zod_1.z.string().uuid('ID da conversa inválido').optional(),
    text: zod_1.z.string().min(1, 'Texto ou áudio é obrigatório').max(10000, 'Texto deve ter no máximo 10000 caracteres').optional(),
    audioUrl: zod_1.z.string().url('URL de áudio inválida').optional(),
    media: zod_1.z.array(exports.mediaItemSchema).max(10, 'Máximo 10 itens de mídia').optional(),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
}).refine((data) => data.text || data.audioUrl, {
    message: 'Texto ou audioUrl é obrigatório',
    path: ['text'],
});
//# sourceMappingURL=social-chat.schemas.js.map