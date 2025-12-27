"use strict";
// src/types/unifycard-event.types.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventContextBuilder = void 0;
exports.validateEventContext = validateEventContext;
/**
 * Validação em runtime
 */
function validateEventContext(ctx) {
    if (!ctx || typeof ctx !== 'object')
        return false;
    const validModules = ['EVENT', 'CONSUMPTION', 'PARKING'];
    if (!validModules.includes(ctx.module))
        return false;
    if (ctx.entityType !== 'event')
        return false;
    const requiredFields = ['entityId', 'eventType', 'cityId', 'globalUserId'];
    for (const field of requiredFields) {
        if (typeof ctx[field] !== 'string' || !ctx[field])
            return false;
    }
    return true;
}
/**
 * Builder para contexto de evento
 */
class EventContextBuilder {
    static forTicket(params) {
        return {
            module: 'EVENT',
            entityType: 'event',
            entityId: params.eventId,
            eventType: params.eventType,
            cityId: params.cityId,
            globalUserId: params.userId,
            ticketId: params.ticketId
        };
    }
    static forConsumption(params) {
        return {
            module: 'CONSUMPTION',
            entityType: 'event',
            entityId: params.eventId,
            eventType: params.eventType,
            cityId: params.cityId,
            globalUserId: params.userId,
            consumptionId: params.consumptionId,
            // 🔴 MVP: Consumo herda split do evento (sem regra própria)
            parentModule: 'EVENT'
        };
    }
}
exports.EventContextBuilder = EventContextBuilder;
//# sourceMappingURL=unifycard-event.types.js.map