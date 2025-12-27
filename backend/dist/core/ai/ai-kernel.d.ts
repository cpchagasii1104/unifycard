/**
 * AI Development Kernel - Main Kernel
 *
 * Classe principal que orquestra o sistema de raciocínio interno do Unificard.
 * Singleton thread-safe e tenant-aware.
 */
import { AIContext } from "./ai-context";
import { AIThought } from "./ai-engine";
export interface KernelRunResult {
    success: boolean;
    thought?: AIThought;
    result?: any;
    error?: string;
    tenantId?: string;
}
export interface KernelTaskResult {
    success: boolean;
    result?: any;
    error?: string;
    tenantId?: string;
}
/**
 * AIKernel - Classe principal do AI Development Kernel
 *
 * Singleton thread-safe que fornece acesso unificado ao sistema de raciocínio
 * e automação interno do Unificard.
 */
export declare class AIKernel {
    private static instance;
    private static initializationLock;
    private context;
    private engine;
    private initialized;
    private currentTenantId;
    /**
     * Construtor privado para garantir padrão singleton
     */
    private constructor();
    /**
     * Obtém a instância única do AIKernel (singleton)
     * Thread-safe usando double-check locking pattern
     */
    static getInstance(): AIKernel;
    /**
     * Inicializa o kernel
     * Pode ser chamado múltiplas vezes de forma segura (idempotente)
     */
    init(tenantId?: string): Promise<void>;
    /**
     * Executa um prompt através do engine
     * Tenant-aware: considera tenantId se fornecido
     */
    run(prompt: string, payload?: any, tenantId?: string): Promise<KernelRunResult>;
    /**
     * Resume uma sessão de trabalho completada
     * Gera um resumo textual da sessão para armazenamento no Memory Engine
     */
    summarizeWorkSession(payload: {
        tenantId: string;
        userId: string;
        jobId: string;
        assignmentId: string;
        workerId: string;
        timestamp: string;
    }): Promise<string>;
    /**
     * Executa uma tarefa específica pelo nome
     * Tenant-aware: passa tenantId para tarefas que suportam
     */
    task(name: string, ...args: any[]): Promise<KernelTaskResult>;
    /**
     * Retorna o contexto atual do projeto
     */
    getContext(): AIContext;
    /**
     * Retorna o tenantId atual (se houver)
     */
    getCurrentTenantId(): string | null;
    /**
     * Define o tenantId atual
     */
    setTenantId(tenantId: string | null): void;
    /**
     * Verifica se o kernel está inicializado
     */
    isInitialized(): boolean;
    /**
     * Reseta o kernel (útil para testes)
     * ATENÇÃO: Use apenas em ambiente de desenvolvimento/testes
     */
    static reset(): void;
}
/**
 * Exporta instância singleton para uso direto
 */
export declare const kernel: AIKernel;
//# sourceMappingURL=ai-kernel.d.ts.map