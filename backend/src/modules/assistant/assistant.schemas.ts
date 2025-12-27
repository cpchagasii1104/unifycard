// src/modules/assistant/assistant.schemas.ts
import { z } from 'zod';

export const assistantChannelSchema = z.enum(['chat', 'social', 'voice']);

export const assistantTargetTypeSchema = z.enum(['user', 'company', 'global']);

export const sendAssistantMessageSchema = z.object({
  text: z.string().min(1, 'Texto é obrigatório').max(5000, 'Texto deve ter no máximo 5000 caracteres'),
  channel: assistantChannelSchema.optional(),
  targetType: assistantTargetTypeSchema.optional(),
  targetGlobalUserId: z.string().uuid('ID do usuário alvo inválido').optional(),
  targetCompanyId: z.string().uuid('ID da empresa alvo inválido').optional(),
  sessionId: z.string().uuid('ID da sessão inválido').optional(),
});








