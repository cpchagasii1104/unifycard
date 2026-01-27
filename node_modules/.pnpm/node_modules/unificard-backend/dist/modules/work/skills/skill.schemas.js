"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSkillsQuerySchema = exports.skillIdParamsSchema = exports.updateSkillSchema = exports.createSkillSchema = void 0;
// backend/src/modules/work/skills/skill.schemas.ts
const zod_1 = require("zod");
exports.createSkillSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    category: zod_1.z.string().min(1).max(100),
    description: zod_1.z.string().min(1).max(2000).optional(),
});
exports.updateSkillSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).optional(),
    category: zod_1.z.string().min(1).max(100).optional(),
    description: zod_1.z.string().min(1).max(2000).optional(),
});
exports.skillIdParamsSchema = zod_1.z.object({
    skillId: zod_1.z.string().uuid(),
});
exports.listSkillsQuerySchema = zod_1.z.object({
    category: zod_1.z.string().optional(),
    search: zod_1.z.string().optional(),
    limit: zod_1.z
        .string()
        .optional()
        .transform(v => (v ? parseInt(v) : undefined)),
    offset: zod_1.z
        .string()
        .optional()
        .transform(v => (v ? parseInt(v) : undefined)),
});
