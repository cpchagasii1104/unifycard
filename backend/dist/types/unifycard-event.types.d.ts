/**
 * 🔴 CRÍTICO: Contrato formal de contexto de evento
 * UnifyCard → UnifyBank SEMPRE usa este formato
 */
export interface UnifyCardEventContext {
    module: 'EVENT' | 'CONSUMPTION' | 'PARKING';
    entityType: 'event';
    entityId: string;
    eventType: string;
    cityId: string;
    globalUserId: string;
    parentModule?: 'EVENT';
    ticketId?: string;
    consumptionId?: string;
    parkingId?: string;
    scheduleSlotId?: string;
}
/**
 * Validação em runtime
 */
export declare function validateEventContext(ctx: any): ctx is UnifyCardEventContext;
/**
 * Builder para contexto de evento
 */
export declare class EventContextBuilder {
    static forTicket(params: {
        eventId: string;
        eventType: string;
        cityId: string;
        userId: string;
        ticketId: string;
    }): UnifyCardEventContext;
    static forConsumption(params: {
        eventId: string;
        eventType: string;
        cityId: string;
        userId: string;
        consumptionId: string;
    }): UnifyCardEventContext;
}
//# sourceMappingURL=unifycard-event.types.d.ts.map