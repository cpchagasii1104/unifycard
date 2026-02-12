// src/core/economy/transactions/transaction.schemas.ts
import { z } from 'zod';

/**
 * Schema para criar transferência
 */
export const createTransferSchema = z.object({
  fromAccount: z.string().uuid('Invalid source account ID'),
  toAccount: z.string().uuid('Invalid destination account ID'),
  amountCents: z.number().positive('Amount must be greater than zero'),
  eventId: z.string().uuid('Invalid event ID').optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * Schema para validar transaction ID
 */
export const transactionIdSchema = z.object({
  transactionId: z.string().uuid('Invalid transaction ID'),
});

/**
 * Schema para validar event ID
 */
export const eventIdSchema = z.object({
  eventId: z.string().uuid('Invalid event ID'),
});

/**
 * Schema para validar account ID
 */
export const accountIdSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
});

/**
 * Schema para query params de listagem
 */
export const listTransactionsQuerySchema = z.object({
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
  offset: z.string().transform(Number).pipe(z.number().min(0)).optional(),
});

export type CreateTransferInput = z.infer<typeof createTransferSchema>;

