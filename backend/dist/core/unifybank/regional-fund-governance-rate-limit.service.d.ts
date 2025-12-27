declare class RegionalFundGovernanceRateLimitService {
    private readonly MAX_PROPOSALS_PER_MONTH;
    private readonly MAX_VOTES_PER_MINUTE;
    /**
     * Verifica rate limit para criar proposta (3/mês)
     */
    checkProposalRateLimit(tenantId: string, globalUserId: string): Promise<{
        allowed: boolean;
        currentCount: number;
        maxCount: number;
        resetAt: Date;
    }>;
    /**
     * Verifica rate limit para votar (10/min)
     */
    checkVoteRateLimit(tenantId: string, globalUserId: string): Promise<{
        allowed: boolean;
        currentCount: number;
        maxCount: number;
        resetAt: Date;
    }>;
}
export declare const regionalFundGovernanceRateLimitService: RegionalFundGovernanceRateLimitService;
export {};
//# sourceMappingURL=regional-fund-governance-rate-limit.service.d.ts.map