// POST /marketplace/inventory/movements — payload validado (§ borda: referência obrigatória para idempotência operacional)
import { z } from 'zod';

export const createInventoryMovementBodySchema = z
  .object({
    actorId: z.string().uuid(),
    productVariantId: z.string().uuid(),
    movementType: z.enum(['in', 'out', 'adjustment']),
    quantity: z.number(),
    unit: z.string().min(1).max(50).optional(),
    reason: z.string().max(255).optional(),
    referenceType: z.string().min(1).max(100),
    referenceId: z.string().uuid(),
    inventoryLotId: z.string().uuid().nullable().optional(),
    metadata: z.record(z.unknown()).optional(),
    createdByUserId: z.string().uuid().optional(),
  })
  .strict();

export type CreateInventoryMovementBody = z.infer<typeof createInventoryMovementBodySchema>;