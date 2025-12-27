import type { UserMemoryPreferenceRow, UserMemoryInteractionRow, UserMemoryEntityRow, UserMemoryShortcutRow } from './memory.types';
export declare class MemoryRepository {
    /**
     * Busca ou cria preferência
     */
    upsertPreference(data: {
        tenantId: string;
        globalUserId: string;
        category: string;
        key: string;
        value: any;
        confidence?: number;
    }): Promise<UserMemoryPreferenceRow>;
    /**
     * Busca preferências do usuário
     */
    findPreferencesByUser(tenantId: string, globalUserId: string, category?: string): Promise<UserMemoryPreferenceRow[]>;
    /**
     * Busca ou cria interação
     */
    upsertInteraction(data: {
        tenantId: string;
        globalUserId: string;
        intent: string;
        entityType: string;
        entityId?: string | null;
        entityName?: string | null;
        parameters: Record<string, any>;
    }): Promise<UserMemoryInteractionRow>;
    /**
     * Busca interações recentes do usuário
     */
    findRecentInteractions(tenantId: string, globalUserId: string, limit?: number): Promise<UserMemoryInteractionRow[]>;
    /**
     * Busca ou cria entidade
     */
    upsertEntity(data: {
        tenantId: string;
        globalUserId: string;
        entityType: string;
        targetGlobalUserId?: string | null;
        targetCompanyId?: string | null;
        entityName: string;
        entityMetadata: Record<string, any>;
        relevanceScore?: number;
    }): Promise<UserMemoryEntityRow>;
    /**
     * Busca entidades frequentes do usuário
     */
    findFrequentEntities(tenantId: string, globalUserId: string, entityType?: string, limit?: number): Promise<UserMemoryEntityRow[]>;
    /**
     * Busca ou cria shortcut
     */
    upsertShortcut(data: {
        tenantId: string;
        globalUserId: string;
        label: string;
        intent: string;
        parameters: Record<string, any>;
    }): Promise<UserMemoryShortcutRow>;
    /**
     * Busca shortcuts sugeridos do usuário
     */
    findSuggestedShortcuts(tenantId: string, globalUserId: string, limit?: number): Promise<UserMemoryShortcutRow[]>;
}
//# sourceMappingURL=memory.repository.d.ts.map