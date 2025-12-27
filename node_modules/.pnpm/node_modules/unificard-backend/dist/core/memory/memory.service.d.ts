import type { UserPreferences, UserContext, UpdateFromIntentInput, RegisterInteractionInput, UserMemoryShortcut } from './memory.types';
declare class MemoryService {
    private repository;
    private contextStore;
    /**
     * Salva contexto no store em memória
     * Usado para armazenar eventos e contextos temporários
     */
    saveContext(key: string, data: any): Promise<void>;
    /**
     * Busca contextos por chave e filtro opcional
     */
    getContextsByKey(key: string, filter?: (data: any) => boolean): Array<{
        key: string;
        data: any;
        timestamp: number;
    }>;
    /**
     * Busca contextos por userId
     */
    getContextsByUserId(userId: string, key?: string): Array<{
        key: string;
        data: any;
        timestamp: number;
    }>;
    /**
     * Atualiza memória a partir de uma intent executada
     */
    updateFromIntent(tenantId: string, globalUserId: string, input: UpdateFromIntentInput): Promise<void>;
    /**
     * Extrai preferências dos parâmetros
     */
    private extractPreferences;
    /**
     * Verifica se é uma ação frequente (para criar shortcut)
     */
    private isFrequentAction;
    /**
     * Gera label para shortcut
     */
    private generateShortcutLabel;
    /**
     * Busca preferências do usuário
     */
    getUserPreferences(tenantId: string, globalUserId: string, category?: string): Promise<UserPreferences>;
    /**
     * Busca ações sugeridas (shortcuts)
     */
    getSuggestedActions(tenantId: string, globalUserId: string, limit?: number): Promise<UserMemoryShortcut[]>;
    /**
     * Registra interação com entidade
     */
    registerInteraction(tenantId: string, globalUserId: string, input: RegisterInteractionInput): Promise<void>;
    /**
     * Busca contexto completo do usuário
     */
    getUserContext(tenantId: string, globalUserId: string): Promise<UserContext>;
}
export declare const memoryService: MemoryService;
export {};
//# sourceMappingURL=memory.service.d.ts.map