import type { Account, CreateAccountInput, OwnerType, Currency, AccountsSearchResult } from './account.types';
declare class AccountService {
    /**
     * Converte row do banco para objeto Account
     */
    private toAccount;
    /**
     * Busca conta específica por ID
     */
    getAccountById(tenantId: string, accountId: string): Promise<Account | null>;
    /**
     * Busca todas as contas de um owner
     */
    getAccountsByOwner(tenantId: string, ownerId: string, ownerType: OwnerType): Promise<Account[]>;
    /**
     * Busca OU cria a conta primária de um usuário
     */
    getOrCreateUserPrimaryAccount(tenantId: string, userId: string, currency?: Currency): Promise<Account>;
    /**
     * Cria conta manualmente
     */
    createAccount(tenantId: string, input: CreateAccountInput): Promise<Account>;
    /**
     * Lista contas
     */
    listAccounts(tenantId: string, options?: {
        limit?: number;
        offset?: number;
        ownerType?: OwnerType;
    }): Promise<AccountsSearchResult>;
    /**
     * Verifica se uma conta existe
     */
    accountExists(tenantId: string, accountId: string): Promise<boolean>;
    /**
     * Contas de sistema (platform_ops, community_fund)
     */
    getOrCreateSystemAccount(tenantId: string, ownerType: 'platform_ops' | 'community_fund', currency?: Currency): Promise<Account>;
    /**
     * Retorna o saldo de uma conta
     */
    getBalance(tenantId: string, accountId: string): Promise<number>;
    /**
     * Busca conta primária de um usuário
     */
    getUserAccount(tenantId: string, userId: string, currency?: Currency): Promise<Account | null>;
    /**
     * Busca conta da plataforma
     */
    getPlatformAccount(tenantId: string, currency?: Currency): Promise<Account>;
    /**
     * Busca conta do fundo comunitário
     */
    getCommunityFundAccount(tenantId: string, currency?: Currency): Promise<Account>;
    /**
     * Busca todas as contas de um global_user_id (agregado de todos os tenants)
     * NOTA: Este método requer owner_global_user_id que pode não existir.
     * Para compatibilidade, retorna array vazio se a coluna não existir.
     * Use getAccountsByOwner com userId resolvido como alternativa.
     */
    getAccountsByGlobalUserId(globalUserId: string): Promise<Account[]>;
    /**
     * Busca conta primária de um global_user_id em uma moeda específica
     */
    getPrimaryAccountByGlobalUserId(globalUserId: string, currency?: Currency): Promise<Account | null>;
}
export declare const accountService: AccountService;
export {};
//# sourceMappingURL=account.service.d.ts.map