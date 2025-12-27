export declare class EventScheduleService {
    /**
     * Cria schedule para evento (idempotente)
     */
    ensureEventSchedule(eventId: string, tenantId: string): Promise<string>;
    /**
     * Gera slots baseado no tipo de evento (idempotente)
     */
    generateEventSlots(eventId: string, tenantId: string): Promise<number>;
    private buildSlotsByType;
    private generateHourlySlots;
}
//# sourceMappingURL=EventScheduleService.d.ts.map