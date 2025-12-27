"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchCalculateSchema = exports.simulateSchema = exports.autoDistributeSchema = exports.feeConfigSchema = void 0;
// src/core/economy/distribution/distribution.schemas.ts
const zod_1 = require("zod");
exports.feeConfigSchema = zod_1.z.object({
    platformFeePercent: zod_1.z.number().min(0).max(100).optional(),
    communityFeePercent: zod_1.z.number().min(0).max(100).optional(),
    groupFeePercent: zod_1.z.number().min(0).max(100).optional(),
});
exports.autoDistributeSchema = zod_1.z.object({
    fromAccount: zod_1.z.string().uuid('Invalid source account ID'),
    toAccount: zod_1.z.string().uuid('Invalid destination account ID'),
    amount: zod_1.z.number().positive('Amount must be greater than zero'),
    groupAccount: zod_1.z.string().uuid('Invalid group account ID').optional(),
    config: exports.feeConfigSchema.optional(),
});
exports.simulateSchema = zod_1.z.object({
    amount: zod_1.z.number().positive('Amount must be greater than zero'),
    config: exports.feeConfigSchema.optional(),
});
exports.batchCalculateSchema = zod_1.z.object({
    amounts: zod_1.z.array(zod_1.z.number().positive()).min(1).max(100),
    config: exports.feeConfigSchema.optional(),
});
//# sourceMappingURL=distribution.schemas.js.map