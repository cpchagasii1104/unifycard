"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateGlobalIdentitySchema = void 0;
// src/core/identity/identity.schemas.ts
const zod_1 = require("zod");
exports.updateGlobalIdentitySchema = zod_1.z.object({
    fullName: zod_1.z.string().max(255, 'Nome completo deve ter no máximo 255 caracteres').nullable().optional(),
    avatarUrl: zod_1.z.string().url('URL do avatar inválida').max(500, 'URL do avatar deve ter no máximo 500 caracteres').nullable().optional(),
    // 🔴 CRÍTICO: Aceitar string vazia como null e validar formato YYYY-MM-DD
    birthdate: zod_1.z
        .union([
        zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
        zod_1.z.null(),
        zod_1.z.literal(''),
    ])
        .transform((val) => (val === '' ? null : val))
        .nullable()
        .optional(),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
});
