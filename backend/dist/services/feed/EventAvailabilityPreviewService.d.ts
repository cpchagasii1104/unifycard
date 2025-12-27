export interface AvailabilityPreview {
    eventId: string;
    nextAvailableSlots: Array<{
        start: string;
        end: string;
    }>;
    timezone: string;
}
export declare class EventAvailabilityPreviewService {
    /**
     * Busca preview de disponibilidade (READ-ONLY)
     * 🔴 NUNCA reserva, apenas exibe próximos slots disponíveis
     */
    getAvailabilityPreview(eventId: string, tenantId: string): Promise<AvailabilityPreview | null>;
}
//# sourceMappingURL=EventAvailabilityPreviewService.d.ts.map