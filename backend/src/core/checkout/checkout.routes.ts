// src/core/checkout/checkout.routes.ts
// 🔴 CRÍTICO: Rotas de checkout (ingresso + consumo)
import { FastifyPluginAsync } from 'fastify';
import { CheckoutEventTicketInput } from '@unificard/contracts';
import { CheckoutTicketService } from '../../modules/events/CheckoutTicketService';
import { CheckoutConsumptionService } from '../../modules/events/CheckoutConsumptionService';
import {
  AppError,
  BadRequestError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
} from '@core/errors';
import { ErrorCode } from '@core/errors/error-codes';

const ticketService = new CheckoutTicketService();
const consumptionService = new CheckoutConsumptionService();

function mapCheckoutError(error: Error): never {
  if (error.message.includes('Event not found')) {
    throw new NotFoundError(error.message);
  }
  if (error.message.includes('sold out') || error.message.includes('not available')) {
    throw new BadRequestError(error.message, ErrorCode.INVALID_INPUT);
  }
  if (error.message.includes('Payment failed') || error.message.includes('Checkout failed')) {
    throw new AppError(402, error.message, 'PAYMENT_FAILED');
  }
  throw new BadRequestError(error.message, ErrorCode.BAD_REQUEST);
}

const checkoutRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Body: CheckoutEventTicketInput;
  }>('/event-ticket', async (req, reply) => {
    if (!req.user) {
      throw new UnauthorizedError('Not authenticated');
    }

    if (!req.tenant) {
      throw new BadRequestError('Tenant not found', ErrorCode.MISSING_TENANT);
    }

    try {
      const body = req.body as CheckoutEventTicketInput;
      const { eventId, idempotencyKey } = body;
      const userId = req.user.globalUserId || req.user.id;

      if (!eventId) {
        throw new BadRequestError('eventId is required', ErrorCode.VALIDATION_ERROR);
      }

      const result = await ticketService.purchaseTicket({
        eventId,
        buyerUserId: userId,
        tenantId: req.tenant.id,
        idempotencyKey,
      });

      return reply.status(200).send({
        success: true,
        ticketId: result.ticketId,
        qrCode: result.qrCode,
        price: result.price,
        transactionId: result.transactionId || undefined,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof Error) {
        mapCheckoutError(error);
      }
      fastify.log.error({ err: error }, 'Erro ao processar checkout de ingresso');
      throw new InternalServerError('Failed to process ticket checkout');
    }
  });

  fastify.post<{
    Body: {
      eventId: string;
      items: Array<{
        name: string;
        quantity: number;
        price: number;
      }>;
      idempotencyKey?: string;
    };
  }>('/event-consumption', async (req, reply) => {
    if (!req.user) {
      throw new UnauthorizedError('Not authenticated');
    }

    if (!req.tenant) {
      throw new BadRequestError('Tenant not found', ErrorCode.MISSING_TENANT);
    }

    try {
      const { eventId, items } = req.body;
      const userId = req.user.globalUserId || req.user.id;

      if (!eventId) {
        throw new BadRequestError('eventId is required', ErrorCode.VALIDATION_ERROR);
      }

      if (!items || !Array.isArray(items) || items.length === 0) {
        throw new BadRequestError(
          'items is required and must be a non-empty array',
          ErrorCode.VALIDATION_ERROR
        );
      }

      for (const item of items) {
        if (
          !item.name ||
          typeof item.quantity !== 'number' ||
          item.quantity <= 0 ||
          typeof item.price !== 'number' ||
          item.price < 0
        ) {
          throw new BadRequestError(
            'Each item must have name, quantity > 0 and price >= 0',
            ErrorCode.VALIDATION_ERROR
          );
        }
      }

      const result = await consumptionService.registerConsumption({
        eventId,
        userId,
        tenantId: req.tenant.id,
        items,
        idempotencyKey: req.body.idempotencyKey,
      });

      return reply.status(200).send({
        success: true,
        consumptions: result.consumptions,
        totalAmount: result.totalAmount,
        transactionId: result.transactionId || undefined,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof Error) {
        if (error.message.includes('Event not found')) {
          throw new NotFoundError(error.message);
        }
        if (error.message.includes('does not accept consumption')) {
          throw new BadRequestError(error.message, ErrorCode.INVALID_INPUT);
        }
        if (error.message.includes('Payment failed') || error.message.includes('Checkout failed')) {
          throw new AppError(402, error.message, 'PAYMENT_FAILED');
        }
        throw new BadRequestError(error.message, ErrorCode.BAD_REQUEST);
      }
      fastify.log.error({ err: error }, 'Erro ao processar checkout de consumo');
      throw new InternalServerError('Failed to process consumption checkout');
    }
  });
};

export default checkoutRoutes;
