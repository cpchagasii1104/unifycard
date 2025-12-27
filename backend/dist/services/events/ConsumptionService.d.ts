interface ConsumptionRow {
    id: string;
    tenant_id: string;
    event_id: string;
    global_user_id: string;
    item_name: string | null;
    quantity: number;
    unit_price: number;
    total_amount: number;
    transaction_id: string | null;
    status: string;
    metadata: Record<string, any>;
    created_at: Date;
}
export declare class ConsumptionService {
    registerConsumption(params: {
        eventId: string;
        userId: string;
        tenantId: string;
        items: Array<{
            name: string;
            quantity: number;
            price: number;
        }>;
        idempotencyKey?: string;
    }): Promise<{
        consumptions: ConsumptionRow[];
        totalAmount: number;
        transactionId?: string;
    }>;
}
export {};
//# sourceMappingURL=ConsumptionService.d.ts.map