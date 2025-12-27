// src/core/orchestrator/orchestrator.schemas.ts
import { z } from 'zod';

const intentTypeSchema = z.enum([
  'hire_service',
  'buy_product',
  'request_ride',
  'book_event',
  'schedule_service',
  'order_food',
  'delivery_pickup',
  'search_local',
  'post_content',
  'ask_question',
  'support',
]);

const targetModuleSchema = z.enum([
  'work',
  'events',
  'rides',
  'marketplace',
  'commerce',
  'delivery',
  'identity',
  'categories',
  'orchestrator',
]);

export const analyzeTextSchema = z.object({
  text: z.string().min(1, 'Texto é obrigatório').max(10000, 'Texto deve ter no máximo 10000 caracteres'),
  audioUrl: z.string().url('URL de áudio inválida').optional(),
  context: z.object({
    location: z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      cityId: z.string().uuid('ID da cidade inválido').optional(),
    }).optional(),
    previousIntent: intentTypeSchema.optional(),
    userId: z.string().uuid('ID do usuário inválido').optional(),
  }).optional(),
});

export const executeIntentSchema = z.object({
  intent: intentTypeSchema,
  parameters: z.record(z.any()),
  targetModule: targetModuleSchema.optional(),
  userId: z.string().uuid('ID do usuário inválido'),
  tenantId: z.string().uuid('ID do tenant inválido'),
});

export const intentAnalysisSchema = z.object({
  intent: intentTypeSchema,
  confidence: z.number().min(0).max(1),
  parameters: z.record(z.any()).optional(),
  reasoning: z.string().optional(),
});

export const categoryMatchSchema = z.object({
  categoryId: z.string().uuid(),
  categoryName: z.string(),
  categoryPath: z.array(z.string()),
  relevance: z.number().min(0).max(1),
});

export const suggestedActionSchema = z.object({
  action: z.string(),
  module: targetModuleSchema,
  endpoint: z.string().optional(),
  payload: z.record(z.any()).optional(),
  description: z.string(),
});

export const flowStepSchema = z.object({
  step: z.number().int().min(1),
  module: targetModuleSchema,
  action: z.string(),
  description: z.string(),
  required: z.boolean().optional(),
});








