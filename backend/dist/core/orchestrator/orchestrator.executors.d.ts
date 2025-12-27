import type { FastifyInstance } from 'fastify';
import type { IntentType } from './orchestrator.types';
interface ExecutorResult {
    ok: boolean;
    module: string;
    intent: IntentType;
    parameters: Record<string, any>;
    result?: any;
    error?: string;
}
/**
 * Executa intent: hire_service
 * Contrata um serviço profissional
 */
export declare function executeHireService(fastify: FastifyInstance, parameters: Record<string, any>, userId: string, tenantId: string): Promise<ExecutorResult>;
/**
 * Executa intent: schedule_service
 * Agenda um serviço com profissional
 */
export declare function executeScheduleService(fastify: FastifyInstance, parameters: Record<string, any>, userId: string, tenantId: string): Promise<ExecutorResult>;
/**
 * Executa intent: order_food
 * Faz pedido de comida
 */
export declare function executeOrderFood(fastify: FastifyInstance, parameters: Record<string, any>, userId: string, tenantId: string): Promise<ExecutorResult>;
/**
 * Executa intent: buy_product
 * Compra um produto
 */
export declare function executeBuyProduct(fastify: FastifyInstance, parameters: Record<string, any>, userId: string, tenantId: string): Promise<ExecutorResult>;
/**
 * Executa intent: request_ride
 * Solicita transporte
 */
export declare function executeRequestRide(fastify: FastifyInstance, parameters: Record<string, any>, userId: string, tenantId: string): Promise<ExecutorResult>;
/**
 * Executa intent: book_event
 * Reserva ingressos ou sessões de eventos
 */
export declare function executeBookEvent(fastify: FastifyInstance, parameters: Record<string, any>, userId: string, tenantId: string): Promise<ExecutorResult>;
/**
 * Executa intent: search_local
 * Busca empresas e serviços locais
 */
export declare function executeSearchLocal(fastify: FastifyInstance, parameters: Record<string, any>, userId: string, tenantId: string): Promise<ExecutorResult>;
/**
 * Executa intent: delivery_pickup
 * Solicita entrega ou busca de itens
 */
export declare function executeDeliveryPickup(fastify: FastifyInstance, parameters: Record<string, any>, userId: string, tenantId: string): Promise<ExecutorResult>;
/**
 * Executa intent: post_content
 * Cria ou compartilha conteúdo social
 */
export declare function executePostContent(fastify: FastifyInstance, parameters: Record<string, any>, userId: string, tenantId: string): Promise<ExecutorResult>;
/**
 * Executa intent: ask_question
 * Responde pergunta geral usando AI Kernel
 */
export declare function executeAskQuestion(fastify: FastifyInstance, parameters: Record<string, any>, userId: string, tenantId: string): Promise<ExecutorResult>;
/**
 * Executa intent: support
 * Abre chamado de suporte
 */
export declare function executeSupport(fastify: FastifyInstance, parameters: Record<string, any>, userId: string, tenantId: string): Promise<ExecutorResult>;
/**
 * Mapeamento de intents para executores
 */
export declare const INTENT_EXECUTORS: Record<string, (fastify: FastifyInstance, params: Record<string, any>, userId: string, tenantId: string) => Promise<ExecutorResult>>;
export {};
//# sourceMappingURL=orchestrator.executors.d.ts.map