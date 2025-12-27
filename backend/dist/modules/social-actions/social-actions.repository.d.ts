import type { SocialActionRow } from './social-actions.types';
export declare class SocialActionsRepository {
    /**
     * Busca ação por ID
     */
    findById(tenantId: string, actionId: string): Promise<SocialActionRow | null>;
    /**
     * Cria uma nova ação
     */
    create(data: {
        postId: string;
        tenantId: string;
        globalUserId: string;
        intent: string;
        confidence: number | null;
        parameters: Record<string, any>;
    }): Promise<SocialActionRow>;
    /**
     * Atualiza status e resultado de execução
     */
    updateExecution(tenantId: string, actionId: string, status: 'executed' | 'failed' | 'cancelled', executionResult: Record<string, any> | null): Promise<SocialActionRow | null>;
    /**
     * Busca ações por post
     */
    findByPost(tenantId: string, postId: string): Promise<SocialActionRow[]>;
    /**
     * Busca ações por usuário
     */
    findByUser(tenantId: string, globalUserId: string, options?: {
        limit?: number;
        offset?: number;
        status?: string;
    }): Promise<SocialActionRow[]>;
}
//# sourceMappingURL=social-actions.repository.d.ts.map