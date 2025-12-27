export declare class EventService {
    /**
     * Cancela evento
     *
     * 🔴 POLÍTICA MVP:
     * - Tickets: CANCELLED (sem reembolso automático)
     * - Consumo passado: intocado (ledger imutável)
     * - Parking ativo: encerrado
     */
    cancelEvent(params: {
        eventId: string;
        tenantId: string;
        reason: string;
    }): Promise<{
        success: boolean;
    }>;
}
//# sourceMappingURL=EventService.d.ts.map