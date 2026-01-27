"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTransactionsQuerySchema = exports.accountIdSchema = exports.eventIdSchema = exports.transactionIdSchema = exports.createTransferSchema = void 0;
// src/core/economy/transactions/transaction.schemas.ts
const zod_1 = require("zod");
/**
 * Schema para criar transferência
 */
exports.createTransferSchema = zod_1.z.object({
    fromAccount: zod_1.z.string().uuid('Invalid source account ID'),
    toAccount: zod_1.z.string().uuid('Invalid destination account ID'),
    amount: zod_1.z.number().positive('Amount must be greater than zero'),
    eventId: zod_1.z.string().uuid('Invalid event ID').optional(),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
});
/**
 * Schema para validar transaction ID
 */
exports.transactionIdSchema = zod_1.z.object({
    transactionId: zod_1.z.string().uuid('Invalid transaction ID'),
});
/**
 * Schema para validar event ID
 */
exports.eventIdSchema = zod_1.z.object({
    eventId: zod_1.z.string().uuid('Invalid event ID'),
});
/**
 * Schema para validar account ID
 */
exports.accountIdSchema = zod_1.z.object({
    accountId: zod_1.z.string().uuid('Invalid account ID'),
});
/**
 * Schema para query params de listagem
 */
exports.listTransactionsQuerySchema = zod_1.z.object({
    limit: zod_1.z.string().transform(Number).pipe(zod_1.z.number().min(1).max(100)).optional(),
    offset: zod_1.z.string().transform(Number).pipe(zod_1.z.number().min(0)).optional(),
});
