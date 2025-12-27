import type { FastifyInstance } from 'fastify';
import type { CareSession, SendMessageInput, CareResponse, CareSessionWithMessages } from './care.types';
declare class CareService {
    private repository;
    /**
     * Cria ou recupera sessão
     */
    getOrCreateSession(fastify: FastifyInstance, tenantId: string, globalUserId: string, targetGlobalUserId?: string | null, targetCompanyId?: string | null): Promise<CareSession>;
    /**
     * Processa mensagem do usuário
     */
    processUserMessage(fastify: FastifyInstance, tenantId: string, globalUserId: string, input: SendMessageInput): Promise<CareResponse>;
    /**
     * Detecta parâmetros faltantes
     */
    private detectMissingParameters;
    /**
     * Gera resposta do AI
     */
    private generateAIResponse;
    /**
     * Gera resposta de fallback
     */
    private generateFallbackResponse;
    /**
     * Busca sessão com mensagens
     */
    getSession(tenantId: string, sessionId: string): Promise<CareSessionWithMessages | null>;
    /**
     * Busca sessões de um usuário
     */
    getSessionsByUser(tenantId: string, globalUserId: string): Promise<CareSession[]>;
}
export declare const careService: CareService;
export {};
//# sourceMappingURL=care.service.d.ts.map