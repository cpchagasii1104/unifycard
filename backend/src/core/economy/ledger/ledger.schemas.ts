// src/core/economy/ledger/ledger.schemas.ts
import { z } from 'zod';

export const accountIdSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
});

export const transactionIdSchema = z.object({
  transactionId: z.string().uuid('Invalid transaction ID'),
});

export const ledgerQuerySchema = z.object({
  limit: z.string().transform(Number).pipe(z.number().min(1).max(500)).optional(),
  offset: z.string().transform(Number).pipe(z.number().min(0)).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  entryType: z.enum(['credit', 'debit']).optional(),
});

export const summaryQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});
