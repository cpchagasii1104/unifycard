export interface VoteOption {
    index: number;
    text: string;
    count: number;
    percentage: number;
}
export interface VoteResults {
    options: VoteOption[];
    total_votes: number;
    closes_at?: string;
    is_closed: boolean;
}
export declare class SocialVotesService {
    /**
     * Registra voto de um actor em um post
     * REGRA: Uma pessoa = um voto (enforced por UNIQUE constraint)
     */
    castVote(tenantId: string, postId: string, actorId: string, optionIndex: number): Promise<{
        success: boolean;
        message?: string;
    }>;
    /**
     * Busca resultados de uma votação
     */
    getVoteResults(tenantId: string, postId: string): Promise<VoteResults | null>;
    /**
     * Verifica se um actor já votou
     */
    hasVoted(tenantId: string, postId: string, actorId: string): Promise<boolean>;
}
export declare const socialVotesService: SocialVotesService;
//# sourceMappingURL=social-votes.service.d.ts.map