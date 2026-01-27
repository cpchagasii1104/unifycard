"use strict";
// backend/src/core/economy/accounts/account.schemas.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.ownerIdSchema = exports.accountIdSchema = exports.createAccountSchema = void 0;
const zod_1 = require("zod");
/**
 * Schema para criar conta
 */
exports.createAccountSchema = zod_1.z.object({
    ownerId: zod_1.z.string().uuid('Invalid owner ID format'),
    ownerType: zod_1.z.enum(['user', 'merchant', 'community_fund', 'platform_ops', 'group'], {
        errorMap: () => ({
            message: 'Invalid owner type. Must be one of: user, merchant, community_fund, platform_ops, group',
        }),
    }),
    currency: zod_1.z.enum(['BRL', 'USD', 'EUR', 'TEST']).optional(),
});
/**
 * Schema para validar UUID nos params
 */
exports.accountIdSchema = zod_1.z.object({
    accountId: zod_1.z.string().uuid('Invalid account ID format'),
});
/**
 * Schema para validar owner ID nos params
 */
exports.ownerIdSchema = zod_1.z.object({
    ownerId: zod_1.z.string().uuid('Invalid owner ID format'),
});
