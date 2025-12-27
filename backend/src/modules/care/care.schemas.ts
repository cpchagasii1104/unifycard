// src/modules/care/care.schemas.ts
import { z } from 'zod';

export const sendMessageSchema = z.object({
  text: z.string().min(1, 'Texto é obrigatório').max(5000, 'Texto deve ter no máximo 5000 caracteres'),
  targetGlobalUserId: z.string().uuid('ID do usuário alvo inválido').nullable().optional(),
  targetCompanyId: z.string().uuid('ID da empresa alvo inválido').nullable().optional(),
  sessionId: z.string().uuid('ID da sessão inválido').nullable().optional(),
});








