import type { FastifyBaseLogger } from 'fastify';
interface ResolveGroupAccountParams {
    tenantId: string;
    userId: string;
}
declare class GroupAccountService {
    private readonly accountService;
    private readonly logger?;
    constructor(accountService: any, // AccountService instance
    logger?: FastifyBaseLogger | undefined);
    /**
     * Cria ou busca conta econômica para um grupo
     */
    createOrGetGroupAccount(tenantId: string, groupId: string): Promise<string>;
    /**
     * Resolve groupAccountIds para splits econômicos
     * Busca grupos ativos do usuário e retorna contas correspondentes
     */
    resolveGroupAccountIds(params: ResolveGroupAccountParams): Promise<string[]>;
}
export declare const groupAccountService: GroupAccountService;
export {};
//# sourceMappingURL=group-account.service.d.ts.map