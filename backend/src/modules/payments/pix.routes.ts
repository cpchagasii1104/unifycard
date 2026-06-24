// backend/src/modules/payments/pix.routes.ts
// SPRINT 85: PIX INTEGRATION
//
// O webhook PIX desta sprint (`pixWebhookRoutes` → POST /webhooks/pix/:provider) foi DESCARTADO
// (DECISION-0154 / F-CAMADA-1-GATE-IDEMPOTENCIA-OUTBOX-G1 / D1): era GHOST/DEAD — dependia da tabela
// `pix_webhook_events`, nunca criada em migrations, e quebrava em runtime. O caminho canônico vivo é
// `/gateway/pix/webhook` (modules/gateway/pix-webhook.controller): HMAC fail-closed + idempotência de
// ingestão por `gateway_webhook_events`. Aqui resta apenas a leitura de status de cobrança PIX (GET).
// Anti-revival: guard `audit-webhook-resolver-idempotency`.

import type { FastifyInstance } from 'fastify';
import { pixService } from './pix.service';
import { NotFoundError } from '@core/errors';

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

// pixWebhookRoutes (POST /webhooks/pix/:provider) REMOVIDO — D1 DISCARD (ver cabeçalho).
// Caminho canônico vivo: /gateway/pix/webhook (modules/gateway/pix-webhook.controller).
