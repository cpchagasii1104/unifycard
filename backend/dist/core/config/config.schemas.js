"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listFlagsQuerySchema = exports.checkFlagQuerySchema = exports.upsertFlagSchema = exports.flagNameSchema = exports.listConfigsQuerySchema = exports.setConfigSchema = exports.configKeySchema = void 0;
// src/core/config/config.schemas.ts
const zod_1 = require("zod");
exports.configKeySchema = zod_1.z.object({
    module: zod_1.z.string().min(1).max(50),
    key: zod_1.z.string().min(1).max(100),
});
exports.setConfigSchema = zod_1.z.object({
    module: zod_1.z.string().min(1).max(50),
    key: zod_1.z.string().min(1).max(100),
    valueCents: zod_1.z.union([zod_1.z.string(), zod_1.z.number(), zod_1.z.boolean(), zod_1.z.record(zod_1.z.any()), zod_1.z.array(zod_1.z.any())]),
    isSystem: zod_1.z.boolean().optional(),
});
exports.listConfigsQuerySchema = zod_1.z.object({
    module: zod_1.z.string().min(1).max(50).optional(),
    limit: zod_1.z.string().transform(Number).pipe(zod_1.z.number().min(1).max(100)).optional(),
    offset: zod_1.z.string().transform(Number).pipe(zod_1.z.number().min(0)).optional(),
});
exports.flagNameSchema = zod_1.z.object({
    flagName: zod_1.z.string().min(1).max(100),
});
exports.upsertFlagSchema = zod_1.z.object({
    description: zod_1.z.string().max(255).optional(),
    enabled: zod_1.z.boolean().optional(),
    rolloutPercentage: zod_1.z.number().min(0).max(100).optional(),
    userWhitelist: zod_1.z.array(zod_1.z.string().uuid()).optional(),
});
exports.checkFlagQuerySchema = zod_1.z.object({
    userId: zod_1.z.string().uuid().optional(),
});
exports.listFlagsQuerySchema = zod_1.z.object({
    limit: zod_1.z.string().transform(Number).pipe(zod_1.z.number().min(1).max(100)).optional(),
    offset: zod_1.z.string().transform(Number).pipe(zod_1.z.number().min(0)).optional(),
});
