"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendAssistantMessageSchema = exports.assistantTargetTypeSchema = exports.assistantChannelSchema = void 0;
// src/modules/assistant/assistant.schemas.ts
const zod_1 = require("zod");
exports.assistantChannelSchema = zod_1.z.enum(['chat', 'social', 'voice']);
exports.assistantTargetTypeSchema = zod_1.z.enum(['user', 'company', 'global']);
exports.sendAssistantMessageSchema = zod_1.z.object({
    text: zod_1.z.string().min(1, 'Texto é obrigatório').max(5000, 'Texto deve ter no máximo 5000 caracteres'),
    channel: exports.assistantChannelSchema.optional(),
    targetType: exports.assistantTargetTypeSchema.optional(),
    targetGlobalUserId: zod_1.z.string().uuid('ID do usuário alvo inválido').optional(),
    targetCompanyId: zod_1.z.string().uuid('ID da empresa alvo inválido').optional(),
    sessionId: zod_1.z.string().uuid('ID da sessão inválido').optional(),
});
//# sourceMappingURL=assistant.schemas.js.map