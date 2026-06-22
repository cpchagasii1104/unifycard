// src/modules/services/service-hire.routes.ts
// Q4 — Endpoint agregador: cadeia completa de contratação de serviço
// 🔴 BLINDAGEM: Orquestra internamente as 4 etapas; nunca expõe estado parcial

import type { FastifyPluginAsync } from 'fastify';
import { unifiedAvailabilityService } from '@core/availability/unified-availability.service';
import { serviceBookingDecisionService } from './service-booking-decision.service';
import { BookingDecisionStatus } from './service-booking-decision.types';
import { servicePaymentRequestService } from './service-payment-request.service';
import { servicePaymentExecutionService } from './service-payment-execution.service';
import { isServiceFinancialRuntimeEnabled, serviceFinancialDisabledBody } from './service-financial-firewall';

/**
 * POST /services/:serviceId/hire
 *
 * Agrega a cadeia completa de contratação de serviço em um único endpoint:
 *   1. createBooking  — registra a intenção de reserva (availability)
 *   2. createDecision — provider aceita automaticamente no fluxo hire
 *   3. createPaymentRequest — cria o pedido financeiro (payer → receiver)
 *   4. createExecution — executa o pagamento via bank (emite SERVICE_PAYMENT_EXECUTED)
 *
 * Q4 — MVP: elimina necessidade do frontend orquestrar 4 chamadas em ordem.
 * §7 LEI_COERENCIA_SISTEMICA_UNIFICARD: Estado → Financeiro → Evento
 */
const serviceHireRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Params: { serviceId: string };
    Body: {
      availabilityId: string;
      requesterActorId: string;
      providerActorId: string;
      amountCents: number;
      currency?: string;
      splits?: Array<{ receiverActorId: string; amountCents: number; percentage?: number | null }>;
      metadata?: Record<string, unknown>;
    };
  }>(
    '/:serviceId/hire',
    async (req, reply) => {
      // DECISION-0110: fail-closed até a cadeia canônica. O `hire` auto-aceita a decisão (D3) e atinge
      // pagamento — fica desabilitado (firewall ANTES de qualquer etapa; nenhum booking/decisão/dinheiro).
      if (!isServiceFinancialRuntimeEnabled()) {
        return reply.status(403).send(serviceFinancialDisabledBody('POST /services/:serviceId/hire'));
      }
      const tenantId = req.tenant?.id;
      const userId = req.user?.userId;

      if (!tenantId) {
        return reply.status(400).send({ error: 'Tenant context obrigatório' });
      }
      if (!userId) {
        return reply.status(401).send({ error: 'Autenticação obrigatória' });
      }

      const { serviceId } = req.params;
      const {
        availabilityId,
        requesterActorId,
        providerActorId,
        amountCents,
        currency = 'BRL',
        splits,
        metadata = {},
      } = req.body;

      if (!availabilityId || !requesterActorId || !providerActorId || !amountCents) {
        return reply.status(400).send({
          error: 'Campos obrigatórios: availabilityId, requesterActorId, providerActorId, amountCents',
        });
      }

      // PASSO 1 — Criar booking
      // 🔴 serviceId deve constar no metadata para que decision e payment-request o validem
      // 🔴 DECISION-0148 — subject normalizado (userId = req.user.userId real). Rota fica atrás do firewall 0110.
      const booking = await unifiedAvailabilityService.createBooking(tenantId, { subjectUserId: userId, requesterActorId }, {
        availabilityId,
        requesterActorId,
        metadata: { ...metadata, serviceId },
      });

      // PASSO 2 — Aceitar booking (provider decide no fluxo hire)
      await serviceBookingDecisionService.createDecision(tenantId, userId, {
        bookingId: booking.bookingId,
        decidedByActorId: providerActorId,
        status: BookingDecisionStatus.ACCEPTED,
      });

      // PASSO 3 — Criar payment request
      const paymentRequest = await servicePaymentRequestService.createPaymentRequest(
        tenantId,
        userId,
        {
          bookingId: booking.bookingId,
          serviceId,
          payerActorId: requesterActorId,
          receiverActorId: providerActorId,
          amountCents,
          currency,
        }
      );

      // PASSO 4 — Executar pagamento
      const { execution } = await servicePaymentExecutionService.createExecution(
        tenantId,
        userId,
        {
          paymentRequestId: paymentRequest.paymentRequestId,
          splits,
        }
      );

      return reply.status(201).send({
        bookingId: booking.bookingId,
        paymentRequestId: paymentRequest.paymentRequestId,
        executionId: execution.executionId,
        status: 'completed',
      });
    }
  );
};

export default serviceHireRoutes;
