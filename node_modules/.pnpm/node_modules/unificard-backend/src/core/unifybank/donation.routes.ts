// backend/src/core/unifybank/donation.routes.ts
// Rotas para doações via feed
// FASE 4: Doações via Feed

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { donationService } from './donation.service';

// Schema de validação
const createDonationSchema = z.object({
  targetType: z.enum(['user', 'project', 'group'], {
    errorMap: () => ({ message: 'targetType must be "user", "project", or "group"' }),
  }),
  targetId: z.string().uuid('Invalid target ID'),
  amountCents: z.number().positive('Amount must be greater than zero'),
  message: z.string().max(500, 'Message too long').optional(),
  eventId: z.string().uuid('Invalid event ID').optional(),
});

type CreateDonationBody = z.infer<typeof createDonationSchema>;

const donationRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /bank/donate
   * Cria uma doação via feed
   * 
   * Autenticação: OBRIGATÓRIA (JWT)
   * Usa P2P Transfer internamente
   * Registra evento no feed social
   * 
   * Payload:
   * {
   *   "targetType": "user" | "project" | "group",
   *   "targetId": "uuid",
   *   "amount": 50,
   *   "message": "opcional",
   *   "eventId": "uuid" (opcional, para idempotência)
   * }
   * 
   * Respostas:
   * - 200: Doação criada com sucesso
   * - 400: Validação falhou (saldo, limite, self-donation)
   * - 401: Não autenticado
   * - 404: Target não encontrado
   * - 409: eventId duplicado
   * - 500: Erro inesperado
   */
  fastify.post<{ Body: CreateDonationBody }>('/donate', async (req, reply) => {
    // 1. Verificar autenticação
    if (!req.user || !req.user.id) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    const tenantId = req.tenant.id;
    const fromUserId = req.user.id; // fromUserId vem EXCLUSIVAMENTE do JWT

    // 2. Validar payload
    const parsed = createDonationSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parsed.error.errors,
      });
    }

    const { targetType, targetId, amount, message, eventId } = parsed.data;

    // 3. Validar que não está doando para si mesmo (se for user)
    if (targetType === 'user' && fromUserId === targetId) {
      return reply.status(400).send({ error: 'Cannot donate to yourself' });
    }

    try {
      // 4. Criar doação
      const result = await donationService.createDonation(tenantId, {
        fromUserId,
        targetType,
        targetId,
        amount,
        message,
        eventId: eventId || uuidv4(),
      });

      return reply.status(200).send({
        success: true,
        donation: {
          donationId: result.donationId,
          transactionId: result.transactionId,
          fromUserId: result.fromUserId,
          targetType: result.targetType,
          targetId: result.targetId,
          amountCents: result.amount,
          message: result.message,
          feedPostId: result.feedPostId,
          splitGroupId: result.splitGroupId,
          createdAt: result.createdAt,
        },
      });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      const statusCode = err.statusCode || 500;

      // Tratar erros específicos
      if (err.message === 'Insufficient balance') {
        return reply.status(400).send({ error: 'Insufficient balance' });
      }

      if (err.message.includes('not found')) {
        return reply.status(404).send({ error: err.message });
      }

      if (err.message.includes('limit exceeded')) {
        return reply.status(400).send({ error: err.message });
      }

      if (err.message.includes('duplicate') || err.message.includes('already exists')) {
        return reply.status(409).send({ error: 'Duplicate eventId' });
      }

      if (err.message === 'Cannot donate to yourself') {
        return reply.status(400).send({ error: 'Cannot donate to yourself' });
      }

      fastify.log.error({ err: error }, 'Error creating donation');
      return reply.status(statusCode).send({
        error: err.message || 'Donation failed',
      });
    }
  });
};

export default donationRoutes;





























