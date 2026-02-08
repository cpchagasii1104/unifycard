// src/modules/services/service-payment-execution.routes.ts
// Rotas do Domínio de EXECUÇÃO DE PAGAMENTO
// 🔴 BLINDAGEM: Endpoints mínimos (criação, leitura)

import { FastifyPluginAsync } from 'fastify';
import { servicePaymentExecutionService } from './service-payment-execution.service';
import { z } from 'zod';

const createPaymentSplitSchema = z.object({
  receiverActorId: z.string().uuid({ message: 'receiverActorId é obrigatório' }), // OBRIGATÓRIO
  amountCents: z.number().positive('Valor deve ser maior que zero'), // OBRIGATÓRIO
  percentage: z.number().min(0).max(100).nullable().optional(),
  metadata: z.record(z.any()).optional(),
});

const createExecutionSchema = z.object({
  paymentRequestId: z.string().uuid(), // OBRIGATÓRIO
  splits: z.array(createPaymentSplitSchema).optional(), // Se não fornecido, cria split único para receiver
});

const servicePaymentExecutionRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /payments/:paymentRequestId/execute
   * Criar nova execução de pagamento
   * 🔴 BLINDAGEM: paymentRequestId é OBRIGATÓRIO
   * 🔴 BLINDAGEM: Execução só pode existir se houver payment_request = pending
   * 🔴 BLINDAGEM: Execução é explícita, nunca automática
   * 🔴 BLINDAGEM: Soma dos splits = amount da execution
   */
  fastify.post<{
    Params: { paymentRequestId: string };
    Body: z.infer<typeof createExecutionSchema>;
  }>(
    '/:paymentRequestId/execute',
    async (req, reply) => {
      if (!req.user || !req.user.userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }
      if (!req.tenant || !req.tenant.id) {
        return reply.status(400).send({ error: 'Tenant not found' });
      }

      // Validar payload
      const parsed = createExecutionSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parsed.error.errors,
        });
      }

      try {
        const result = await servicePaymentExecutionService.createExecution(
          req.tenant.id,
          req.user.userId,
          {
            paymentRequestId: req.params.paymentRequestId, // paymentRequestId vem da URL
            splits: parsed.data.splits as any, // Cast necessário devido à inferência do Zod
          }
        );

        return reply.status(201).send({ ok: true, data: result });
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao criar execução de pagamento');
        return reply.status(400).send({
          error: 'Erro ao criar execução de pagamento',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * GET /payments/:paymentRequestId/execution
   * Buscar execução de pagamento de um payment request
   * 🔴 BLINDAGEM: Apenas uma execução por payment_request (constraint UNIQUE)
   */
  fastify.get<{ Params: { paymentRequestId: string } }>(
    '/:paymentRequestId/execution',
    async (req, reply) => {
      if (!req.user || !req.user.userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }
      if (!req.tenant || !req.tenant.id) {
        return reply.status(400).send({ error: 'Tenant not found' });
      }

      try {
        const result = await servicePaymentExecutionService.getExecutionByPaymentRequest(
          req.tenant.id,
          req.params.paymentRequestId
        );

        if (!result.execution) {
          return reply.status(404).send({ error: 'Execução não encontrada' });
        }

        return reply.send({ ok: true, data: result });
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao buscar execução de pagamento');
        return reply.status(500).send({
          error: 'Erro ao buscar execução de pagamento',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );
};

export default servicePaymentExecutionRoutes;


