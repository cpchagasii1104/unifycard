"use strict";
// src/modules/events/events-payment.service.ts
// CONTINUOUS PRODUCTION: MIGRATED TO UNIFY BANK
// Serviço de pagamento para eventos (ingressos)
// Integrado com Unify Bank para garantir redistribuição automática
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventsPaymentService = void 0;
const bank_integration_service_1 = require("../bank/bank-integration.service");
class EventsPaymentService {
    /**
     * Processa pagamento de ingresso de evento
     * Usa Unify Bank para redistribuir automaticamente
     *
     * Destinos típicos (via event_ticket context):
     * - Organizador: 70%
     * - Fee (plataforma): 3%
     * - Regional Fund: 10%
     * - Reserve: 17%
     */
    async processEventPayment(input) {
        const { tenantId, eventId, attendeeUserId, organizerId, amount, currency = 'BRL', } = input;
        // Processar pagamento via Unify Bank
        const result = await bank_integration_service_1.bankIntegrationService.processEventTicketPayment(tenantId, {
            eventId,
            buyerUserId: attendeeUserId,
            amount,
            currency: currency,
            metadata: {
                organizerId,
                type: 'event_ticket_purchase',
            },
        });
        // Mapear resultado para formato compatível
        return {
            transactionIds: [result.transactionId],
            splits: result.splits.map((split) => ({
                targetType: 'revenue_share', // Simplificado - detalhes estão no bank
                amountCents: split.amount,
                transactionId: result.transactionId,
            })),
        };
    }
}
exports.eventsPaymentService = new EventsPaymentService();
