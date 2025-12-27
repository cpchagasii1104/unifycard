export declare class TicketService {
    /**
     * Compra ingresso (transação atômica)
     * 🔴 CRÍTICO: UPDATE atômico de capacidade
     */
    purchaseTicket(params: {
        eventId: string;
        buyerUserId: string;
        tenantId: string;
        idempotencyKey?: string;
    }): Promise<{
        ticketId: string;
        qrCode: string;
        price: number | null;
        transactionId?: string;
    }>;
    /**
     * Check-in (valida QR code)
     */
    checkIn(qrCode: string, tenantId: string): Promise<{
        success: boolean;
        event: {
            id: string;
            title: string;
            start_time: Date;
        };
    }>;
}
//# sourceMappingURL=TicketService.d.ts.map