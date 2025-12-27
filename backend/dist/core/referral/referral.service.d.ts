declare class ReferralService {
    /**
     * Gera ou obtém código de indicação do usuário
     */
    getOrCreateReferralCode(tenantId: string, userId: string): Promise<string>;
    /**
     * Busca código de indicação do usuário
     */
    getReferralCode(tenantId: string, userId: string): Promise<string | null>;
    /**
     * Aplica código de indicação (quando novo usuário se registra com código)
     */
    applyReferralCode(tenantId: string, newUserId: string, referralCode: string): Promise<{
        referrerUserId: string;
    }>;
}
export declare const referralService: ReferralService;
export {};
//# sourceMappingURL=referral.service.d.ts.map