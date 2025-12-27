interface ProcessEventPaymentInput {
    tenantId: string;
    eventId: string;
    attendeeUserId: string;
    organizerId?: string;
    amount: number;
    currency?: string;
}
interface ProcessEventPaymentResult {
    transactionIds: string[];
    splits: Array<{
        targetType: string;
        amount: number;
        transactionId?: string;
    }>;
}
declare class EventsPaymentService {
    /**
     * Processa pagamento de ingresso de evento
     * Usa SplitEngine para redistribuir automaticamente
     *
     * Destinos típicos:
     * - Organizador (se houver) → WORKER
     * - Tenant/Plataforma → TENANT
     * - Região → REGION
     * - Grupos do usuário → GROUP
     */
    processEventPayment(input: ProcessEventPaymentInput): Promise<ProcessEventPaymentResult>;
}
export declare const eventsPaymentService: EventsPaymentService;
export {};
//# sourceMappingURL=events-payment.service.d.ts.map