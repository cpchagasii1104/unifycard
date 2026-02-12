// src/core/reputation/reputation.schemas.ts
import { z } from 'zod';

export const entityParamsSchema = z.object({
  entityType: z.string().min(1).max(50),
  entityId: z.string().uuid('Invalid entity ID'),
});
