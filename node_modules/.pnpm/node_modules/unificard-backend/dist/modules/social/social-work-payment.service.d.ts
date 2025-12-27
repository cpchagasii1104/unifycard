import type { Transaction } from '@core/economy/transactions/transaction.types';
declare class SocialWorkPaymentService {
    /**
     * Resolve global_user_id a partir de user_id
     */
    private resolveGlobalUserId;
    /**
     * Resolve job e schedule reservado para o customer a partir de um post
     * Retorna jobId e scheduleId relacionados
     */
    resolveScheduledJobFromPost(postId: string, tenantId: string, customerUserId: string): Promise<{
        jobId: string;
        scheduleId: string;
        slotId: string;
    } | null>;
    /**
     * Cria pagamento a partir de um post
     * Cria transação via economyService
     */
    createPaymentFromPost(postId: string, tenantId: string, customerUserId: string, amount: number): Promise<Transaction>;
}
export declare const socialWorkPaymentService: SocialWorkPaymentService;
export {};
//# sourceMappingURL=social-work-payment.service.d.ts.map