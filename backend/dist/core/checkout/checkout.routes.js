"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TicketService_1 = require("../../services/events/TicketService");
const ConsumptionService_1 = require("../../services/events/ConsumptionService");
const ticketService = new TicketService_1.TicketService();
const consumptionService = new ConsumptionService_1.ConsumptionService();
const checkoutRoutes = async (fastify) => {
    /**
     * POST /api/checkout/event-ticket
     * Checkout de ingresso
     */
    fastify.post('/event-ticket', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const { eventId } = req.body;
            const userId = req.user.globalUserId || req.user.id;
            if (!eventId) {
                return reply.status(400).send({ error: 'eventId é obrigatório' });
            }
            const result = await ticketService.purchaseTicket({
                eventId,
                buyerUserId: userId,
                tenantId: req.tenant.id,
                idempotencyKey: req.body.idempotencyKey,
            });
            return reply.status(200).send({
                success: true,
                ticketId: result.ticketId,
                qrCode: result.qrCode,
                price: result.price,
                transactionId: result.transactionId || undefined,
            });
        }
        catch (error) {
            if (error instanceof Error) {
                // Erros específicos
                if (error.message.includes('Event not found')) {
                    return reply.status(404).send({ error: error.message });
                }
                if (error.message.includes('sold out') || error.message.includes('not available')) {
                    return reply.status(400).send({ error: error.message });
                }
                if (error.message.includes('Payment failed') || error.message.includes('Checkout failed')) {
                    return reply.status(402).send({ error: error.message });
                }
                return reply.status(400).send({ error: error.message });
            }
            fastify.log.error({ err: error }, 'Erro ao processar checkout de ingresso');
            return reply.status(500).send({ error: 'Erro ao processar checkout de ingresso' });
        }
    });
    /**
     * POST /api/checkout/event-consumption
     * Checkout de consumo
     */
    fastify.post('/event-consumption', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const { eventId, items } = req.body;
            const userId = req.user.globalUserId || req.user.id;
            if (!eventId) {
                return reply.status(400).send({ error: 'eventId é obrigatório' });
            }
            if (!items || !Array.isArray(items) || items.length === 0) {
                return reply.status(400).send({ error: 'items é obrigatório e deve ser um array não vazio' });
            }
            // Validação de itens
            for (const item of items) {
                if (!item.name || typeof item.quantity !== 'number' || item.quantity <= 0 || typeof item.price !== 'number' || item.price < 0) {
                    return reply.status(400).send({ error: 'Cada item deve ter name, quantity > 0 e price >= 0' });
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
        }
        catch (error) {
            if (error instanceof Error) {
                // Erros específicos
                if (error.message.includes('Event not found')) {
                    return reply.status(404).send({ error: error.message });
                }
                if (error.message.includes('does not accept consumption')) {
                    return reply.status(400).send({ error: error.message });
                }
                if (error.message.includes('Payment failed') || error.message.includes('Checkout failed')) {
                    return reply.status(402).send({ error: error.message });
                }
                return reply.status(400).send({ error: error.message });
            }
            fastify.log.error({ err: error }, 'Erro ao processar checkout de consumo');
            return reply.status(500).send({ error: 'Erro ao processar checkout de consumo' });
        }
    });
};
exports.default = checkoutRoutes;
