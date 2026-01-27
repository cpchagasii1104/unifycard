// backend/src/modules/services/service-bundle.routes.ts
// Rotas para SERVIÇOS COMBINADOS (Bundles) com co-agendamento

import type { FastifyInstance } from 'fastify';
import { serviceBundleService } from './service-bundle.service';
import type {
  CreateBundleBookingInput,
  ConfirmBundleInput,
} from './service-bundle.types';

const serviceBundleRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /service-bundles/book
   * Cria bundle bookings de forma atômica
   * 
   * REGRAS:
   * - Cria múltiplos bookings vinculados
   * - Todos compartilham mesmo horário/localização se especificado
   * - NÃO cria pagamento automático
   */
  fastify.post<{ Body: CreateBundleBookingInput }>(
    '/service-bundles/book',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const actionContext = (req as any).actionContext;

      if (!actionContext?.actingUserId) {
        return reply.status(400).send({ error: 'actingUserId é obrigatório' });
      }

      const body = req.body;

      // Converter strings para Date se necessário
      const scheduledStart = body.scheduledStart instanceof Date 
        ? body.scheduledStart 
        : new Date(body.scheduledStart);
      const scheduledEnd = body.scheduledEnd instanceof Date 
        ? body.scheduledEnd 
        : new Date(body.scheduledEnd);

      try {
        const result = await serviceBundleService.createBundleBookings(
          tenantId,
          actionContext.actingUserId,
          {
            ...body,
            scheduledStart,
            scheduledEnd,
          }
        );

        return reply.status(201).send(result);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(error.statusCode || 500).send({
          error: error.message || 'Erro ao criar bundle bookings',
        });
      }
    }
  );

  /**
   * GET /service-bundles/:bundleId/bookings
   * Busca bookings de um bundle
   */
  fastify.get<{ Params: { bundleId: string } }>(
    '/service-bundles/:bundleId/bookings',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { bundleId } = req.params;

      try {
        const bookings = await serviceBundleService.getBundleBookings(tenantId, bundleId);
        return reply.send({ bookings });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(error.statusCode || 500).send({
          error: error.message || 'Erro ao buscar bookings do bundle',
        });
      }
    }
  );

  /**
   * GET /service-bundles/:bundleId/can-confirm
   * Verifica se bundle pode ser confirmado
   */
  fastify.get<{ Params: { bundleId: string } }>(
    '/service-bundles/:bundleId/can-confirm',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { bundleId } = req.params;

      try {
        const result = await serviceBundleService.canConfirmBundle(tenantId, bundleId);
        return reply.send(result);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(error.statusCode || 500).send({
          error: error.message || 'Erro ao verificar se bundle pode ser confirmado',
        });
      }
    }
  );

  /**
   * POST /service-bundles/confirm
   * Confirma bundle de forma atômica
   * 
   * REGRAS:
   * - Todos os bookings devem ter decisão ACCEPTED
   * - Todos os service orders são criados ou nenhum
   * - Agenda é bloqueada como conjunto
   * - NÃO cria pagamento automático
   */
  fastify.post<{ Body: ConfirmBundleInput }>(
    '/service-bundles/confirm',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const actionContext = (req as any).actionContext;

      if (!actionContext?.actingActorId) {
        return reply.status(400).send({ error: 'actingActorId é obrigatório' });
      }

      const body = req.body;

      try {
        const result = await serviceBundleService.confirmBundle(tenantId, {
          ...body,
          confirmedByActorId: actionContext.actingActorId,
          confirmedByUserId: actionContext.actingUserId,
        });

        return reply.status(201).send(result);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(error.statusCode || 500).send({
          error: error.message || 'Erro ao confirmar bundle',
        });
      }
    }
  );
};

export default serviceBundleRoutes;




