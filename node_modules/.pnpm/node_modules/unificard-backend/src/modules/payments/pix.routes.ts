// backend/src/modules/payments/pix.routes.ts
// SPRINT 85: PIX INTEGRATION

import type { FastifyInstance } from 'fastify';
import { pixService } from './pix.service';
import { pixWebhookEventRepository } from './pix-webhook.repository';
import { mockPixProvider } from './pix-provider.mock';

const pixRoutes = async (fastify: FastifyInstance) => {
  /**
   * GET /payments/pix/:paymentIntentId
   * Consulta status do charge PIX
   */
  fastify.get<{ Params: { paymentIntentId: string } }>('/payments/pix/:paymentIntentId', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { paymentIntentId } = req.params;

    const charge = await pixService.getChargeByIntent(tenantId, paymentIntentId);

    if (!charge) {
      return reply.status(404).send({ error: 'PixCharge não encontrado' });
    }

    return reply.send({
      status: charge.status,
      qrCode: charge.payloadSnapshot.qrCode,
      qrCodeText: charge.payloadSnapshot.qrCodeText,
      expiresAt: charge.expiresAt.toISOString(),
      paidAt: charge.paidAt?.toISOString() || null,
      amount: charge.amount,
      currency: charge.currency,
    });
  });
};

export default pixRoutes;

/**
 * Webhook PIX (rota pública)
 * POST /webhooks/pix/:provider
 */
export const pixWebhookRoutes = async (fastify: FastifyInstance) => {
  fastify.post<{ Params: { provider: string }; Body: any }>('/webhooks/pix/:provider', async (req, reply) => {
    const provider = req.params.provider;
    const payload = req.body;

    // SPRINT 85: Por enquanto, usar mock provider
    // Futuro: resolver provider baseado em provider param
    const pixProvider = mockPixProvider;

    // 1. Parse webhook
    const webhookEvent = pixProvider.parseWebhook(payload);
    if (!webhookEvent) {
      return reply.status(400).send({ error: 'Webhook payload inválido' });
    }

    // 2. Buscar tenant (futuro: resolver via provider_charge_id ou metadata)
    // Por enquanto, assumir que payload tem tenant_id ou buscar via charge
    let tenantId: string | undefined = payload.tenant_id || payload.metadata?.tenant_id;
    
    if (!tenantId) {
      // Tentar buscar via provider_charge_id
      // Por enquanto, retornar erro (futuro: implementar lookup)
      return reply.status(400).send({ error: 'Tenant ID não encontrado no payload' });
    }

    // 3. Criar webhook event (idempotência)
    const webhookEventRecord = await pixWebhookEventRepository.createEvent(
      tenantId,
      provider,
      webhookEvent.providerEventId,
      payload
    );

    // 4. Se já processado, retornar sucesso (idempotência)
    if (webhookEventRecord.status === 'PROCESSED' || webhookEventRecord.status === 'DUPLICATE') {
      return reply.send({ success: true, message: 'Evento já processado' });
    }

    // 5. Buscar charge
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
      return reply.status(404).send({ error: 'Charge não encontrado' });
    }

    // 6. Se evento é charge.paid, marcar como pago
    if (webhookEvent.eventType === 'charge.paid') {
      try {
        // Marcar charge como pago
        const paidCharge = await pixService.markAsPaid(
          tenantId,
          charge.id,
          webhookEvent.paidAt || new Date()
        );

        // Marcar webhook como processado
        await pixWebhookEventRepository.markAsProcessed(
          tenantId,
          webhookEventRecord.id,
          paidCharge.id
        );

        // Marcar pagamento como SUCCESS
        // SPRINT 87: Integração com subscriptions acontece dentro de markPixPaymentAsSuccess
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
        return reply.status(500).send({ error: 'Erro ao processar webhook' });
      }
    }

    // 7. Outros tipos de evento (expired, cancelled)
    await pixWebhookEventRepository.markAsProcessed(tenantId, webhookEventRecord.id);

    return reply.send({ success: true });
  });
};

