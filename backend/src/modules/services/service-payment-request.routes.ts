// src/modules/services/service-payment-request.routes.ts
// Rotas do Domínio de PAGAMENTO (Payment Request / Payment Intent)
// 🔴 BLINDAGEM: Endpoints mínimos (criação, leitura)

import { FastifyPluginAsync } from 'fastify';
import { servicePaymentRequestService } from './service-payment-request.service';
import { z } from 'zod';

const createPaymentRequestSchema = z.object({
  bookingId: z.string().uuid(), // OBRIGATÓRIO
  serviceId: z.string().uuid(), // OBRIGATÓRIO
  payerActorId: z.string().uuid(), // OBRIGATÓRIO
  receiverActorId: z.string().uuid(), // OBRIGATÓRIO
  amountCents: z.number().positive('Valor deve ser maior que zero'), // OBRIGATÓRIO
  currency: z.string().optional(), // Default: 'FIC'
  metadata: z.record(z.any()).optional(),
});

const updatePaymentRequestSchema = z.object({
  status: z.enum(['pending', 'cancelled', 'expired']).optional(),
  metadata: z.record(z.any()).optional(),
});

const servicePaymentRequestRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /services/:serviceId/bookings/:bookingId/payments
   * Criar novo pedido de pagamento para um booking
   * 🔴 BLINDAGEM: bookingId, serviceId, payerActorId e receiverActorId são OBRIGATÓRIOS
   * 🔴 BLINDAGEM: Só pode criar payment se existir booking_decision = accepted
   * 🔴 BLINDAGEM: Pagamento nasce APÓS booking aceito
   */
  fastify.post<{
    Params: { serviceId: string; bookingId: string };
    Body: z.infer<typeof createPaymentRequestSchema>;
  }>(
    '/:serviceId/bookings/:bookingId/payments',
    async (req, reply) => {
      // ActionContext é obrigatório (V2)
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }
      if (!req.tenant || !req.tenant.id) {
        return reply.status(400).send({ error: 'Tenant not found' });
      }

      // Validar payload
      const parsed = createPaymentRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parsed.error.errors,
        });
      }

      try {
        const paymentRequest = await servicePaymentRequestService.createPaymentRequest(
          req.tenant.id,
          req.actionContext.actorId,
          {
            bookingId: req.params.bookingId, // bookingId vem da URL
            serviceId: req.params.serviceId, // serviceId vem da URL
            payerActorId: parsed.data.payerActorId,
            receiverActorId: parsed.data.receiverActorId,
            amountCents: parsed.data.amountCents,
            currency: parsed.data.currency,
            metadata: parsed.data.metadata,
          }
        );

        return reply.status(201).send({ ok: true, data: paymentRequest });
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao criar payment request');
        return reply.status(400).send({
          error: 'Erro ao criar payment request',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * GET /services/:serviceId/bookings/:bookingId/payments
   * Buscar pedido de pagamento de um booking
   * 🔴 BLINDAGEM: Apenas um pedido de pagamento por booking (constraint UNIQUE)
   */
  fastify.get<{ Params: { serviceId: string; bookingId: string } }>(
    '/:serviceId/bookings/:bookingId/payments',
    async (req, reply) => {
      // ActionContext é obrigatório (V2)
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }
      if (!req.tenant || !req.tenant.id) {
        return reply.status(400).send({ error: 'Tenant not found' });
      }

      // 🔒 F-C1-MONEY-SPR-READ-AUTHORITY-HARDENING (DECISION-0113): autoridade de LEITURA.
      // req.user (server-side) DEVE REPRESENTAR o payer OU o receiver da relação financeira.
      // actionContext.actorId/tenant_id NÃO autorizam sozinhos; nada move dinheiro aqui.
      const userId = req.user?.userId;
      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      try {
        const paymentRequest = await servicePaymentRequestService.getPaymentRequestByBooking(
          req.tenant.id,
          req.params.bookingId
        );

        if (!paymentRequest) {
          return reply.status(404).send({ error: 'Payment request não encontrado' });
        }

        // payer = requester do booking · receiver = dono do service (ambos validados na criação e
        // persistidos no payment request). O chamador deve representar AO MENOS UMA parte. Sem isso → 403.
        const { authorizationService } = await import('@core/authorization/authorization.service');
        const canRead =
          (await authorizationService.canRepresentActor(req.tenant.id, userId, paymentRequest.payerActorId)) ||
          (await authorizationService.canRepresentActor(req.tenant.id, userId, paymentRequest.receiverActorId));
        if (!canRead) {
          return reply.status(403).send({
            error: 'Caller must represent the payer or receiver of this payment request.',
          });
        }

        return reply.send({ ok: true, data: paymentRequest });
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao buscar payment request');
        return reply.status(500).send({
          error: 'Erro ao buscar payment request',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );
};

export default servicePaymentRequestRoutes;


