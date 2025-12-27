import type { CareSessionRow, CareMessageRow } from './care.types';
export declare class CareRepository {
    /**
     * Busca sessão por ID
     */
    findSessionById(tenantId: string, sessionId: string): Promise<CareSessionRow | null>;
    /**
     * Busca sessão ativa por usuário e target
     */
    findActiveSession(tenantId: string, globalUserId: string, targetGlobalUserId?: string | null, targetCompanyId?: string | null): Promise<CareSessionRow | null>;
    /**
     * Cria uma nova sessão
     */
    createSession(data: {
        tenantId: string;
        globalUserId: string;
        targetGlobalUserId?: string | null;
        targetCompanyId?: string | null;
        state: any;
        context: any;
    }): Promise<CareSessionRow>;
    /**
     * Atualiza estado e contexto da sessão
     */
    updateSession(tenantId: string, sessionId: string, updates: {
        lastMessage?: string;
        state?: any;
        context?: any;
    }): Promise<CareSessionRow | null>;
    /**
     * Busca mensagens de uma sessão
     */
    findMessagesBySession(tenantId: string, sessionId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<{
        rows: CareMessageRow[];
        total: number;
    }>;
    /**
     * Cria uma nova mensagem
     */
    createMessage(data: {
        tenantId: string;
        careSessionId: string;
        isFromUser: boolean;
        content: string;
        intent?: string | null;
        parameters?: any;
        aiReasoning?: any;
    }): Promise<CareMessageRow>;
    /**
     * Busca sessões de um usuário
     */
    findSessionsByUser(tenantId: string, globalUserId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<{
        rows: CareSessionRow[];
        total: number;
    }>;
}
//# sourceMappingURL=care.repository.d.ts.map