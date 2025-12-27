interface ProcessCatalogOrderPaymentInput {
    tenantId: string;
    orderId: string;
    buyerUserId: string;
    sellerUserId?: string;
    amount: number;
    currency?: string;
}
interface ProcessCatalogOrderPaymentResult {
    transactionIds: string[];
    splits: Array<{
        targetType: string;
        amount: number;
        transactionId?: string;
    }>;
}
declare class CatalogPaymentService {
    /**
     * Processa pagamento de pedido do catálogo
     * Usa SplitEngine para redistribuir automaticamente
     *
     * Destinos típicos:
     * - Vendedor/Merchant → WORKER
     * - Tenant/Plataforma → TENANT
     * - Região → REGION
     * - Grupos do usuário → GROUP
     */
    processOrderPayment(input: ProcessCatalogOrderPaymentInput): Promise<ProcessCatalogOrderPaymentResult>;
}
export declare const catalogPaymentService: CatalogPaymentService;
export {};
//# sourceMappingURL=catalog-payment.service.d.ts.map