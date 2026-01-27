"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMessageSchema = void 0;
// src/modules/care/care.schemas.ts
const zod_1 = require("zod");
exports.sendMessageSchema = zod_1.z.object({
    text: zod_1.z.string().min(1, 'Texto é obrigatório').max(5000, 'Texto deve ter no máximo 5000 caracteres'),
    targetGlobalUserId: zod_1.z.string().uuid('ID do usuário alvo inválido').nullable().optional(),
    targetCompanyId: zod_1.z.string().uuid('ID da empresa alvo inválido').nullable().optional(),
    sessionId: zod_1.z.string().uuid('ID da sessão inválido').nullable().optional(),
});
