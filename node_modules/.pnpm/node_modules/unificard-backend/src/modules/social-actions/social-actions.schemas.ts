// src/modules/social-actions/social-actions.schemas.ts
import { z } from 'zod';

export const createActionSchema = z.object({
  postId: z.string().uuid('ID do post inválido'),
  intent: z.string().min(1, 'Intent é obrigatória'),
  confidence: z.number().min(0).max(1, 'Confiança deve estar entre 0 e 1').optional(),
  parameters: z.record(z.any()),
});

export const executeActionSchema = z.object({
  actionId: z.string().uuid('ID da ação inválido'),
});

export const actionStatusSchema = z.enum(['available', 'executed', 'failed', 'cancelled']);








