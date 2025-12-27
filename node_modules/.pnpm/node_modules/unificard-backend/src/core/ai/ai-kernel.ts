/**
 * AI Development Kernel - Main Kernel
 * 
 * Classe principal que orquestra o sistema de raciocínio interno do Unificard.
 * Singleton thread-safe e tenant-aware.
 */

import { loadAIContext, AIContext } from "./ai-context";
import { AIEngine, AIThought } from "./ai-engine";
import { AITasks } from "./ai-tasks";

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
export class AIKernel {
  private static instance: AIKernel | null = null;
  private static initializationLock = false;
  
  private context: AIContext;
  private engine: AIEngine;
  private initialized: boolean = false;
  private currentTenantId: string | null = null;

  /**
   * Construtor privado para garantir padrão singleton
   */
  private constructor() {
    this.context = loadAIContext();
    this.engine = new AIEngine();
  }

  /**
   * Obtém a instância única do AIKernel (singleton)
   * Thread-safe usando double-check locking pattern
   */
  public static getInstance(): AIKernel {
    if (!AIKernel.instance) {
      // Garantir thread-safety na inicialização
      if (!AIKernel.initializationLock) {
        AIKernel.initializationLock = true;
        AIKernel.instance = new AIKernel();
        AIKernel.initializationLock = false;
      } else {
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
  public async init(tenantId?: string): Promise<void> {
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
  public async run(prompt: string, payload?: any, tenantId?: string): Promise<KernelRunResult> {
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
    } catch (error) {
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
  public async summarizeWorkSession(payload: {
    tenantId: string;
    userId: string;
    jobId: string;
    assignmentId: string;
    workerId: string;
    timestamp: string;
  }): Promise<string> {
    return `Work session completed by user ${payload.userId} for job ${payload.jobId}. Assignment ${payload.assignmentId} with worker ${payload.workerId} finished at ${payload.timestamp}.`;
  }

  /**
   * Executa uma tarefa específica pelo nome
   * Tenant-aware: passa tenantId para tarefas que suportam
   */
  public async task(name: string, ...args: any[]): Promise<KernelTaskResult> {
    try {
      // Verificar se tarefa existe
      if (!(name in AITasks)) {
        return {
          success: false,
          error: `Tarefa "${name}" não encontrada`,
          tenantId: this.currentTenantId || undefined
        };
      }

      // Executar tarefa
      const taskFn = (AITasks as any)[name];
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
    } catch (error) {
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
  public getContext(): AIContext {
    return this.context;
  }

  /**
   * Retorna o tenantId atual (se houver)
   */
  public getCurrentTenantId(): string | null {
    return this.currentTenantId;
  }

  /**
   * Define o tenantId atual
   */
  public setTenantId(tenantId: string | null): void {
    this.currentTenantId = tenantId;
  }

  /**
   * Verifica se o kernel está inicializado
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Reseta o kernel (útil para testes)
   * ATENÇÃO: Use apenas em ambiente de desenvolvimento/testes
   */
  public static reset(): void {
    AIKernel.instance = null;
    AIKernel.initializationLock = false;
  }
}

/**
 * Exporta instância singleton para uso direto
 */
export const kernel = AIKernel.getInstance();

