interface RateLimitResult {
    allowed: boolean;
    remaining?: number;
    resetAt?: Date;
}
declare class HobbyRateLimitService {
    private readonly MAX_ATTEMPTS;
    private readonly WINDOW_MS;
    /**
     * Verifica rate limit para adição de hobbies
     *
     * @param userId - ID do usuário
     * @param tenantId - ID do tenant
     * @returns true se permitido, false se excedeu limite
     */
    checkRateLimit(userId: string, tenantId: string): Promise<RateLimitResult>;
    /**
     * Verifica limite de hobbies por usuário (máx 30)
     *
     * @param globalUserId - Global user ID
     * @returns true se pode adicionar mais, false se atingiu limite
     */
    checkHobbyLimit(globalUserId: string): Promise<{
        allowed: boolean;
        currentCount: number;
        maxCount: number;
    }>;
}
export declare const hobbyRateLimitService: HobbyRateLimitService;
export type { RateLimitResult };
//# sourceMappingURL=hobby-rate-limit.service.d.ts.map