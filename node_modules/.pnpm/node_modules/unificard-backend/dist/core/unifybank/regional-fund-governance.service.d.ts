export type ProposalType = 'PROJECT_FUNDING' | 'REGIONAL_REINVESTMENT' | 'COMMUNITY_EXPENSE';
export type ProposalStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'EXECUTING' | 'EXECUTED' | 'REJECTED';
export type VoteValue = 'YES' | 'NO';
export interface CreateProposalInput {
    title: string;
    description: string;
    proposalType: ProposalType;
    targetType: 'project' | 'group' | 'platform' | 'regional_fund';
    targetId?: string;
    amount: number;
    votingStartsAt: Date;
    votingEndsAt: Date;
}
export interface Proposal {
    proposalId: string;
    tenantId: string;
    regionId: string;
    title: string;
    description: string;
    proposalType: ProposalType;
    targetType: string;
    targetId?: string;
    amount: number;
    status: ProposalStatus;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    votingStartsAt?: Date;
    votingEndsAt?: Date;
    executedAt?: Date;
    metadata: Record<string, any>;
}
export interface VoteResult {
    yes: number;
    no: number;
    total: number;
    quorumMet: boolean;
    approved: boolean;
}
export interface ProposalWithVotes extends Proposal {
    votes: VoteResult;
    eligibleUsers: number;
}
declare class RegionalFundGovernanceService {
    private readonly QUORUM_PERCENTAGE;
    private readonly MIN_ACTIVE_TRANSACTIONS;
    /**
     * Resolve regionId do tenant
     */
    private resolveRegionId;
    /**
     * Conta usuários elegíveis para votar na região
     * Elegíveis: usuários da mesma região com >= 1 transação
     */
    private countEligibleUsers;
    /**
     * Verifica se usuário é elegível para votar
     */
    private isUserEligible;
    /**
     * Cria uma proposta
     */
    createProposal(tenantId: string, globalUserId: string, input: CreateProposalInput): Promise<Proposal>;
    /**
     * Abre votação de uma proposta
     */
    openVoting(tenantId: string, proposalId: string): Promise<Proposal>;
    /**
     * Registra voto de um usuário
     */
    vote(tenantId: string, proposalId: string, globalUserId: string, vote: VoteValue): Promise<void>;
    /**
     * Fecha votação de uma proposta
     */
    closeVoting(tenantId: string, proposalId: string): Promise<Proposal>;
    /**
     * Gera eventId determinístico para execução de proposta
     */
    private generateExecutionEventId;
    /**
     * Executa transferência dentro de uma transação existente
     * (versão interna que aceita client já em transação)
     */
    private transferWithClient;
    /**
     * Executa uma proposta aprovada
     * ATÔMICO: Tudo em uma única transação SQL com FOR UPDATE
     */
    executeProposal(tenantId: string, proposalId: string): Promise<{
        proposal: Proposal;
        transactionId: string;
    }>;
    /**
     * Lista propostas
     */
    listProposals(tenantId: string, options?: {
        regionId?: string;
        status?: ProposalStatus;
        limit?: number;
        offset?: number;
    }): Promise<ProposalWithVotes[]>;
    /**
     * Obtém uma proposta específica
     */
    getProposal(tenantId: string, proposalId: string): Promise<ProposalWithVotes | null>;
    /**
     * Converte row do banco para objeto Proposal
     */
    private toProposal;
    /**
     * Converte row do banco para objeto Proposal (com campos novos)
     */
    private toProposalWithExecution;
    /**
     * Helper: verifica se usuário é admin (allowlist)
     * Público para uso nas rotas
     */
    isAdmin(globalUserId: string): boolean;
    /**
     * Helper: obtém userId a partir de globalUserId
     */
    private getUserIdFromGlobalId;
}
export declare const regionalFundGovernanceService: RegionalFundGovernanceService;
export {};
//# sourceMappingURL=regional-fund-governance.service.d.ts.map