import { CheckoutRequest, CheckoutResult } from '@unificard/contracts';
/**
 * Serviço central de Checkout
 * Orquestra pagamento via UnifyCard e split via UnifyBank
 */
export declare class CheckoutService {
    /**
     * Processa checkout completo (pagamento + split)
     * 🔴 CRÍTICO: Atomicidade garantida por runTenantTransaction
     */
    processCheckout(tenantId: string, input: CheckoutRequest): Promise<CheckoutResult>;
    /**
     * Mock de UnifyCard (temporário)
     * Em produção, substituir por chamada real ao serviço de UnifyCard
     */
    private mockUnifyCardCharge;
}
export declare const checkoutService: CheckoutService;
//# sourceMappingURL=CheckoutService.d.ts.map