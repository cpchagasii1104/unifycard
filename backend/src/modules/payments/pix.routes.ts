// backend/src/modules/payments/pix.routes.ts
// SPRINT 85: PIX INTEGRATION

import type { FastifyInstance } from 'fastify';
import { pixService } from './pix.service';
import { pixWebhookEventRepository } from './pix-webhook.repository';
import { mockPixProvider } from './pix-provider.mock';
import { BadRequestError, InternalServerError, NotFoundError } from '@core/errors';
import { ErrorCode } from '@core/errors/error-codes';

const pixRoutes = async (fastify: FastifyInstance) => {
  fastify.get<{ Params: { paymentIntentId: string } }>('/payments/pix/:paymentIntentId', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { paymentIntentId } = req.params;

    const charge = await pixService.getChargeByIntent(tenantId, paymentIntentId);

    if (!charge) {
      throw new NotFoundError('PIX charge not found');
    }

    return reply.send({
      status: charge.status,
      qrCode: charge.payloadSnapshot.qrCode,
      qrCodeText: charge.payloadSnapshot.qrCodeText,
      expiresAt: charge.expiresAt.toISOString(),
      paidAt: charge.paidAt?.toISOString() || null,
      amountCents: charge.amountCents,
      currency: charge.currency,
    });
  });
};

export default pixRoutes;

export const pixWebhookRoutes = async (fastify: FastifyInstance) => {
  fastify.post<{ Params: { provider: string }; Body: any }>('/webhooks/pix/:provider', async (req, reply) => {
    const provider = req.params.provider;
    const payload = req.body as {
      tenant_id?: string;
      metadata?: { tenant_id?: string };
      [key: string]: unknown;
    };

    const pixProvider = mockPixProvider;

    const webhookEvent = pixProvider.parseWebhook(payload);
    if (!webhookEvent) {
      throw new BadRequestError('Invalid webhook payload', ErrorCode.INVALID_INPUT);
    }

    let tenantId: string | undefined = payload.tenant_id || payload.metadata?.tenant_id;

    if (!tenantId) {
      throw new BadRequestError('Tenant ID not found in payload', ErrorCode.MISSING_TENANT);
    }

    const webhookEventRecord = await pixWebhookEventRepository.createEvent(
      tenantId,
      provider,
      webhookEvent.providerEventId,
      payload
    );

    if (webhookEventRecord.status === 'PROCESSED' || webhookEventRecord.status === 'DUPLICATE') {
      return reply.send({ success: true, message: 'Evento já processado' });
    }

    const charge = await pixService.getChargeByProviderChargeId(
      tenantId,
      provider,
      webhookEvent.chargeId
    );

    if (!charge) {
      await pixWebhookEventRepository.markAsFailed(
        tenantId,
        webhookEventRecord.id,
        `Charge não encontrado: ${webhookEvent.chargeId}`
      );
      throw new NotFoundError('Charge not found');
    }

    if (webhookEvent.eventType === 'charge.paid') {
      try {
        const paidCharge = await pixService.markAsPaid(
          tenantId,
          charge.id,
          webhookEvent.paidAt || new Date()
        );

        await pixWebhookEventRepository.markAsProcessed(
          tenantId,
          webhookEventRecord.id,
          paidCharge.id
        );

        const { paymentExecutionService } = await import('../marketplace/payment-execution.service');
        await paymentExecutionService.markPixPaymentAsSuccess(
          tenantId,
          charge.paymentIntentId,
          charge.id
        );

        return reply.send({ success: true, chargeId: paidCharge.id });
      } catch (error: any) {
        await pixWebhookEventRepository.markAsFailed(
          tenantId,
          webhookEventRecord.id,
          error.message || 'Erro ao processar webhook'
        );
        throw new InternalServerError('Failed to process webhook');
      }
    }

    await pixWebhookEventRepository.markAsProcessed(tenantId, webhookEventRecord.id);

    return reply.send({ success: true });
  });
};
