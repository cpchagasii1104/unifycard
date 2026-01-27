"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.summaryQuerySchema = exports.ledgerQuerySchema = exports.transactionIdSchema = exports.accountIdSchema = void 0;
// src/core/economy/ledger/ledger.schemas.ts
const zod_1 = require("zod");
exports.accountIdSchema = zod_1.z.object({
    accountId: zod_1.z.string().uuid('Invalid account ID'),
});
exports.transactionIdSchema = zod_1.z.object({
    transactionId: zod_1.z.string().uuid('Invalid transaction ID'),
});
exports.ledgerQuerySchema = zod_1.z.object({
    limit: zod_1.z.string().transform(Number).pipe(zod_1.z.number().min(1).max(500)).optional(),
    offset: zod_1.z.string().transform(Number).pipe(zod_1.z.number().min(0)).optional(),
    startDate: zod_1.z.string().datetime().optional(),
    endDate: zod_1.z.string().datetime().optional(),
    entryType: zod_1.z.enum(['credit', 'debit']).optional(),
});
exports.summaryQuerySchema = zod_1.z.object({
    startDate: zod_1.z.string().datetime().optional(),
    endDate: zod_1.z.string().datetime().optional(),
});
