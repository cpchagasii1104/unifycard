"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignRoleByNameSchema = exports.updateRoleSchema = exports.createRoleSchema = exports.roleUserParamsSchema = exports.userIdSchema = exports.roleIdSchema = void 0;
// src/core/rbac/role.schemas.ts
const zod_1 = require("zod");
exports.roleIdSchema = zod_1.z.object({
    roleId: zod_1.z.string().uuid('Invalid role ID'),
});
exports.userIdSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid('Invalid user ID'),
});
exports.roleUserParamsSchema = zod_1.z.object({
    roleId: zod_1.z.string().uuid('Invalid role ID'),
    userId: zod_1.z.string().uuid('Invalid user ID'),
});
exports.createRoleSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(50),
    description: zod_1.z.string().max(255).optional(),
});
exports.updateRoleSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(50).optional(),
    description: zod_1.z.string().max(255).optional(),
});
exports.assignRoleByNameSchema = zod_1.z.object({
    roleName: zod_1.z.string().min(2).max(50),
});
//# sourceMappingURL=role.schemas.js.map