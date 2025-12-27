import type { FastifyInstance } from 'fastify';
import type { SocialAction, CreateActionInput, ExecuteActionResult } from './social-actions.types';
declare class SocialActionsService {
    private repository;
    /**
     * Cria uma ação a partir de um post
     */
    createAction(tenantId: string, globalUserId: string, input: CreateActionInput): Promise<SocialAction>;
    /**
     * Busca ação por ID
     */
    getAction(tenantId: string, actionId: string): Promise<SocialAction | null>;
    /**
     * Busca ações por post
     */
    getActionsByPost(tenantId: string, postId: string): Promise<SocialAction[]>;
    /**
     * Executa uma ação usando o orchestrator
     */
    executeAction(fastify: FastifyInstance, tenantId: string, actionId: string, userId: string): Promise<ExecuteActionResult>;
    /**
     * Cancela uma ação
     */
    cancelAction(tenantId: string, actionId: string, userId: string): Promise<void>;
}
export declare const socialActionsService: SocialActionsService;
export {};
//# sourceMappingURL=social-actions.service.d.ts.map