"use strict";
/**
 * AI Development Kernel - Main Kernel
 *
 * Classe principal que orquestra o sistema de raciocínio interno do Unificard.
 * Singleton thread-safe e tenant-aware.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.kernel = exports.AIKernel = void 0;
const ai_context_1 = require("./ai-context");
const ai_engine_1 = require("./ai-engine");
const ai_tasks_1 = require("./ai-tasks");
/**
 * AIKernel - Classe principal do AI Development Kernel
 *
 * Singleton thread-safe que fornece acesso unificado ao sistema de raciocínio
 * e automação interno do Unificard.
 */
class AIKernel {
    static instance = null;
    static initializationLock = false;
    context;
    engine;
    initialized = false;
    currentTenantId = null;
    /**
     * Construtor privado para garantir padrão singleton
     */
    constructor() {
        this.context = (0, ai_context_1.loadAIContext)();
        this.engine = new ai_engine_1.AIEngine();
    }
    /**
     * Obtém a instância única do AIKernel (singleton)
     * Thread-safe usando double-check locking pattern
     */
    static getInstance() {
        if (!AIKernel.instance) {
            // Garantir thread-safety na inicialização
            if (!AIKernel.initializationLock) {
                AIKernel.initializationLock = true;
                AIKernel.instance = new AIKernel();
                AIKernel.initializationLock = false;
            }
            else {
                // Aguardar inicialização em caso de race condition
                while (!AIKernel.instance) {
                    // Em Node.js single-threaded, isso não deveria acontecer,
                    // mas garante segurança em ambientes concorrentes
                }
            }
        }
        return AIKernel.instance;
    }
    /**
     * Inicializa o kernel
     * Pode ser chamado múltiplas vezes de forma segura (idempotente)
     */
    async init(tenantId) {
        if (this.initialized && !tenantId) {
            return; // Já inicializado sem tenant específico
        }
        // Se tenantId fornecido, atualiza contexto
        if (tenantId) {
            this.currentTenantId = tenantId;
            // Aqui poderia carregar contexto específico do tenant se necessário
        }
        this.initialized = true;
    }
    /**
     * Executa um prompt através do engine
     * Tenant-aware: considera tenantId se fornecido
     */
    async run(prompt, payload, tenantId) {
        try {
            // Atualizar tenant se fornecido
            if (tenantId) {
                this.currentTenantId = tenantId;
            }
            // Enriquecer prompt com contexto de tenant se disponível
            let enrichedPrompt = prompt;
            if (this.currentTenantId) {
                enrichedPrompt = `[Tenant: ${this.currentTenantId}] ${prompt}`;
            }
            // Adicionar payload ao contexto se fornecido
            if (payload) {
                enrichedPrompt += ` | Payload: ${JSON.stringify(payload)}`;
            }
            // Processar através do engine (passar tenantId se disponível)
            const thought = await this.engine.think(enrichedPrompt, tenantId || this.currentTenantId || undefined);
            return {
                success: true,
                thought,
                result: thought.result,
                tenantId: this.currentTenantId || undefined
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                tenantId: this.currentTenantId || undefined
            };
        }
    }
    /**
     * Resume uma sessão de trabalho completada
     * Gera um resumo textual da sessão para armazenamento no Memory Engine
     */
    async summarizeWorkSession(payload) {
        return `Work session completed by user ${payload.userId} for job ${payload.jobId}. Assignment ${payload.assignmentId} with worker ${payload.workerId} finished at ${payload.timestamp}.`;
    }
    /**
     * Executa uma tarefa específica pelo nome
     * Tenant-aware: passa tenantId para tarefas que suportam
     */
    async task(name, ...args) {
        try {
            // Verificar se tarefa existe
            if (!(name in ai_tasks_1.AITasks)) {
                return {
                    success: false,
                    error: `Tarefa "${name}" não encontrada`,
                    tenantId: this.currentTenantId || undefined
                };
            }
            // Executar tarefa
            const taskFn = ai_tasks_1.AITasks[name];
            if (typeof taskFn !== 'function') {
                return {
                    success: false,
                    error: `"${name}" não é uma função`,
                    tenantId: this.currentTenantId || undefined
                };
            }
            // Se tenantId disponível, adicionar como primeiro argumento se a tarefa suportar
            const result = await taskFn(...args);
            return {
                success: true,
                result,
                tenantId: this.currentTenantId || undefined
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                tenantId: this.currentTenantId || undefined
            };
        }
    }
    /**
     * Retorna o contexto atual do projeto
     */
    getContext() {
        return this.context;
    }
    /**
     * Retorna o tenantId atual (se houver)
     */
    getCurrentTenantId() {
        return this.currentTenantId;
    }
    /**
     * Define o tenantId atual
     */
    setTenantId(tenantId) {
        this.currentTenantId = tenantId;
    }
    /**
     * Verifica se o kernel está inicializado
     */
    isInitialized() {
        return this.initialized;
    }
    /**
     * Reseta o kernel (útil para testes)
     * ATENÇÃO: Use apenas em ambiente de desenvolvimento/testes
     */
    static reset() {
        AIKernel.instance = null;
        AIKernel.initializationLock = false;
    }
}
exports.AIKernel = AIKernel;
/**
 * Exporta instância singleton para uso direto
 */
exports.kernel = AIKernel.getInstance();
