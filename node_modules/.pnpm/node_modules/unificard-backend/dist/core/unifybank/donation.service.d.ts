export type DonationTargetType = 'user' | 'project' | 'group';
export interface CreateDonationInput {
    fromUserId: string;
    targetType: DonationTargetType;
    targetId: string;
    amount: number;
    message?: string;
    eventId?: string;
}
export interface DonationResult {
    donationId: string;
    transactionId: string;
    fromUserId: string;
    targetType: DonationTargetType;
    targetId: string;
    amount: number;
    message?: string;
    feedPostId?: string;
    splitGroupId?: string;
    createdAt: Date;
}
declare class DonationService {
    private socialRepository;
    private readonly MAX_DONATIONS_PER_DAY;
    /**
     * Resolve conta de destino baseado no tipo
     */
    private resolveTargetAccount;
    /**
     * Verifica se target existe
     */
    private validateTarget;
    /**
     * Verifica rate limit (máx 20 doações/dia por usuário)
     */
    private checkRateLimit;
    /**
     * Cria evento no feed social
     */
    private createFeedEvent;
    /**
     * Cria uma doação
     *
     * Fluxo:
     * 1. Validar entrada
     * 2. Verificar rate limit
     * 3. Validar target existe
     * 4. Resolver contas
     * 5. Executar P2P Transfer
     * 6. Criar evento no feed
     * 7. Retornar resultado
     */
    createDonation(tenantId: string, input: CreateDonationInput): Promise<DonationResult>;
}
export declare const donationService: DonationService;
export {};
//# sourceMappingURL=donation.service.d.ts.map