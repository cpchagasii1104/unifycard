// src/modules/services/service-booking-decision.routes.ts
// Rotas do Domínio de CONFIRMAÇÃO / DECISÃO DE BOOKING
// 🔴 BLINDAGEM: Endpoints mínimos (criação, leitura)

import { FastifyPluginAsync } from 'fastify';
import { serviceBookingDecisionService } from './service-booking-decision.service';
import { z } from 'zod';

const createDecisionSchema = z.object({
  bookingId: z.string().uuid(), // OBRIGATÓRIO
  decidedByActorId: z.string().uuid(), // OBRIGATÓRIO
  status: z.enum(['accepted', 'rejected']), // OBRIGATÓRIO
  reason: z.string().nullable().optional(),
  metadata: z.record(z.any()).optional(),
});

const serviceBookingDecisionRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /services/:serviceId/bookings/:bookingId/decision
   * Criar nova decisão para um booking
   * 🔴 BLINDAGEM: bookingId e decidedByActorId são OBRIGATÓRIOS
   * 🔴 BLINDAGEM: Decisão é humana explícita, nunca automática
   * 🔴 BLINDAGEM: Apenas dono do service pode decidir
   */
  fastify.post<{
    Params: { serviceId: string; bookingId: string };
    Body: z.infer<typeof createDecisionSchema>;
  }>(
    '/:serviceId/bookings/:bookingId/decision',
    async (req, reply) => {
      if (!req.user || !req.user.userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }
      if (!req.tenant || !req.tenant.id) {
        return reply.status(400).send({ error: 'Tenant not found' });
      }

      // Validar payload
      const parsed = createDecisionSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parsed.error.errors,
        });
      }

      try {
        const decision = await serviceBookingDecisionService.createDecision(
          req.tenant.id,
          req.user.userId,
          {
            bookingId: req.params.bookingId, // bookingId vem da URL
            decidedByActorId: parsed.data.decidedByActorId,
            status: parsed.data.status as any,
            reason: parsed.data.reason,
            metadata: parsed.data.metadata,
          }
        );

        return reply.status(201).send({ ok: true, data: decision });
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao criar decisão de booking');
        // Honrar statusCode de HttpError (403 mismatch de autoridade / 409 serviço alheio ao dono);
        // demais erros mantêm 400 (default).
        const statusCode = (error as { statusCode?: number })?.statusCode ?? 400;
        return reply.status(statusCode).send({
          error: 'Erro ao criar decisão de booking',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * GET /services/:serviceId/bookings/:bookingId/decision
   * Buscar decisão de um booking
   * 🔴 BLINDAGEM: Apenas uma decisão por booking
   * Booking continua existindo mesmo se rejeitado
   * Decisão não apaga booking
   */
  fastify.get<{ Params: { serviceId: string; bookingId: string } }>(
    '/:serviceId/bookings/:bookingId/decision',
    async (req, reply) => {
      if (!req.user || !req.user.userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }
      if (!req.tenant || !req.tenant.id) {
        return reply.status(400).send({ error: 'Tenant not found' });
      }

      try {
        const decision = await serviceBookingDecisionService.getDecisionByBooking(
          req.tenant.id,
          req.params.bookingId
        );

        if (!decision) {
          return reply.status(404).send({ error: 'Decisão não encontrada' });
        }

        return reply.send({ ok: true, data: decision });
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao buscar decisão de booking');
        return reply.status(500).send({
          error: 'Erro ao buscar decisão de booking',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );
};

export default serviceBookingDecisionRoutes;

