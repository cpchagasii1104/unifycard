"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.linkEventSchema = exports.addMemberSchema = exports.createOrganizerSchema = void 0;
// src/modules/events/organizers/organizers.schemas.ts
const zod_1 = require("zod");
exports.createOrganizerSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Nome é obrigatório').max(200, 'Nome deve ter no máximo 200 caracteres'),
    description: zod_1.z.string().max(5000, 'Descrição deve ter no máximo 5000 caracteres').nullable().optional(),
    logoUrl: zod_1.z.string().url('URL do logo inválida').nullable().optional(),
});
exports.addMemberSchema = zod_1.z.object({
    globalUserId: zod_1.z.string().uuid('ID do usuário global inválido'),
    role: zod_1.z.enum(['owner', 'admin', 'editor', 'viewer'], {
        errorMap: () => ({ message: 'Role deve ser: owner, admin, editor ou viewer' }),
    }),
});
exports.linkEventSchema = zod_1.z.object({
    organizerId: zod_1.z.string().uuid('ID do organizador inválido'),
});
//# sourceMappingURL=organizers.schemas.js.map