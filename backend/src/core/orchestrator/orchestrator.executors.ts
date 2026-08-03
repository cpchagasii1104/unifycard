// src/core/orchestrator/orchestrator.executors.ts
// Intent Execution Engine
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CONTIDO — 10 dos 11 executores NUNCA chamaram o módulo real
// ║ NORMA:   "sucesso relatado sem a ação real ter acontecido" é o padrão de erro nº4 do catálogo
// ║          de legado (Clayton, 2026-08-03). Métrica/resposta que AFIRMA o que não fez é pior que
// ║          erro: o chamador segue como se tivesse funcionado.
// ║ NÃO:     NÃO devolver ok:true com payload inventado (era `orderId/ticketId: 'placeholder-id'`,
// ║          `message: 'Pedido criado'`). NÃO apagar o executor — a assinatura e o mapa de intents
// ║          são o contrato que a implementação real vai preencher.
// ║ EM VEZ:  responder ok:false com INTENT_EXECUTOR_NOT_IMPLEMENTED, dizendo o que NÃO aconteceu.
// ╚════════════════════════════════════════════════════════════════
//
// CONTEXTO: o arquivo estava DORMENTE quando isto foi escrito — orchestrator.routes.ts e
// intent-orchestrator.routes.ts existem mas NÃO estão registrados em app.builder.ts (medido).
// Por isso a contenção, e não o conserto: se um dia alguém registrar aquelas rotas, o sistema
// NÃO volta a dizer "Pedido criado" sem criar pedido. Ligar cada intent ao módulo real é fatia
// própria, uma por vez, com o writer canônico de cada domínio.
//
// ⚠️ `executeAskQuestion` NÃO foi contido: ele chama `aiKernel.run` de verdade — é o único real.

import type { FastifyInstance } from 'fastify';
import { categoriesService } from '../categories/categories.service';
import type { IntentType, ExecutionResult } from './orchestrator.types';

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
export async function executeHireService(
  fastify: FastifyInstance,
  parameters: Record<string, any>,
  userId: string,
  tenantId: string
): Promise<ExecutorResult> {
  try {
    // Validar parâmetros
    const serviceType = parameters.serviceType || parameters.service || parameters.category;
    if (!serviceType) {
      return {
        ok: false,
        module: 'work',
        intent: 'hire_service',
        parameters,
        error: 'Tipo de serviço não especificado',
      };
    }

    // Buscar categoria se fornecido como string
    let categoryId = parameters.categoryId;
    if (!categoryId && typeof serviceType === 'string') {
      const categories = await categoriesService.searchCategories(serviceType, 1, undefined, 'professional');
      if (categories.length > 0) {
        categoryId = categories[0].categoryId;
      }
    }

    // Montar payload para módulo work
    const payload = {
      categoryId,
      serviceType: typeof serviceType === 'string' ? serviceType : undefined,
      location: parameters.location,
      filters: {
        minRating: parameters.minRating,
        maxDistance: parameters.maxDistance,
        availableNow: parameters.availableNow,
      },
    };

    // Chamar módulo work (placeholder por enquanto)
    // TODO: Implementar chamada real quando módulo work estiver completo
    // const result = await fastify.inject({
    //   method: 'POST',
    //   url: '/work/workers/search',
    //   payload,
    //   headers: { 'x-tenant-id': tenantId, 'x-user-id': userId }
    // });

    return {
      ok: false,
      module: 'work',
      intent: 'hire_service',
      parameters,
      error: 'INTENT_EXECUTOR_NOT_IMPLEMENTED: a intencao hire_service ainda nao esta ligada ao modulo work. Nada foi criado, reservado ou cobrado.',
    };
  } catch (error) {
    return {
      ok: false,
      module: 'work',
      intent: 'hire_service',
      parameters,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Executa intent: schedule_service
 * Agenda um serviço com profissional
 */
export async function executeScheduleService(
  fastify: FastifyInstance,
  parameters: Record<string, any>,
  userId: string,
  tenantId: string
): Promise<ExecutorResult> {
  try {
    // Validar parâmetros obrigatórios
    if (!parameters.workerId && !parameters.serviceId) {
      return {
        ok: false,
        module: 'work',
        intent: 'schedule_service',
        parameters,
        error: 'workerId ou serviceId é obrigatório',
      };
    }

    if (!parameters.date || !parameters.time) {
      return {
        ok: false,
        module: 'work',
        intent: 'schedule_service',
        parameters,
        error: 'data e horário são obrigatórios',
      };
    }

    // Montar payload
    const payload = {
      workerId: parameters.workerId,
      serviceId: parameters.serviceId,
      date: parameters.date,
      time: parameters.time,
      duration: parameters.duration || 60, // minutos
      notes: parameters.notes,
    };

    // Chamar módulo work
    // TODO: Implementar chamada real
    return {
      ok: false,
      module: 'work',
      intent: 'schedule_service',
      parameters,
      error: 'INTENT_EXECUTOR_NOT_IMPLEMENTED: a intencao schedule_service ainda nao esta ligada ao modulo work. Nada foi criado, reservado ou cobrado.',
    };
  } catch (error) {
    return {
      ok: false,
      module: 'work',
      intent: 'schedule_service',
      parameters,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Executa intent: order_food
 * Faz pedido de comida
 */
export async function executeOrderFood(
  fastify: FastifyInstance,
  parameters: Record<string, any>,
  userId: string,
  tenantId: string
): Promise<ExecutorResult> {
  try {
    // Validar parâmetros
    if (!parameters.restaurantId && !parameters.restaurantName) {
      return {
        ok: false,
        module: 'commerce',
        intent: 'order_food',
        parameters,
        error: 'restaurantId ou restaurantName é obrigatório',
      };
    }

    if (!parameters.items || !Array.isArray(parameters.items) || parameters.items.length === 0) {
      return {
        ok: false,
        module: 'commerce',
        intent: 'order_food',
        parameters,
        error: 'itens do pedido são obrigatórios',
      };
    }

    // Montar payload
    const payload = {
      restaurantId: parameters.restaurantId,
      restaurantName: parameters.restaurantName,
      items: parameters.items,
      deliveryAddress: parameters.deliveryAddress,
      paymentMethod: parameters.paymentMethod,
      notes: parameters.notes,
    };

    // Chamar módulo commerce
    // TODO: Implementar chamada real
    return {
      ok: false,
      module: 'commerce',
      intent: 'order_food',
      parameters,
      error: 'INTENT_EXECUTOR_NOT_IMPLEMENTED: a intencao order_food ainda nao esta ligada ao modulo commerce. Nada foi criado, reservado ou cobrado.',
    };
  } catch (error) {
    return {
      ok: false,
      module: 'commerce',
      intent: 'order_food',
      parameters,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Executa intent: buy_product
 * Compra um produto
 */
export async function executeBuyProduct(
  fastify: FastifyInstance,
  parameters: Record<string, any>,
  userId: string,
  tenantId: string
): Promise<ExecutorResult> {
  try {
    // Validar parâmetros
    if (!parameters.productId && !parameters.productName) {
      return {
        ok: false,
        module: 'commerce',
        intent: 'buy_product',
        parameters,
        error: 'productId ou productName é obrigatório',
      };
    }

    // Buscar categoria se fornecido
    let categoryId = parameters.categoryId;
    if (!categoryId && parameters.category) {
      const categories = await categoriesService.searchCategories(parameters.category, 1, undefined, 'professional');
      if (categories.length > 0) {
        categoryId = categories[0].categoryId;
      }
    }

    // Montar payload
    const payload = {
      productId: parameters.productId,
      productName: parameters.productName,
      categoryId,
      quantity: parameters.quantity || 1,
      variant: parameters.variant,
      deliveryAddress: parameters.deliveryAddress,
      paymentMethod: parameters.paymentMethod,
    };

    // Chamar módulo commerce
    // TODO: Implementar chamada real
    return {
      ok: false,
      module: 'commerce',
      intent: 'buy_product',
      parameters,
      error: 'INTENT_EXECUTOR_NOT_IMPLEMENTED: a intencao buy_product ainda nao esta ligada ao modulo commerce. Nada foi criado, reservado ou cobrado.',
    };
  } catch (error) {
    return {
      ok: false,
      module: 'commerce',
      intent: 'buy_product',
      parameters,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Executa intent: request_ride
 * Solicita transporte
 */
export async function executeRequestRide(
  fastify: FastifyInstance,
  parameters: Record<string, any>,
  userId: string,
  tenantId: string
): Promise<ExecutorResult> {
  try {
    // Validar parâmetros obrigatórios
    if (!parameters.origin) {
      return {
        ok: false,
        module: 'rides',
        intent: 'request_ride',
        parameters,
        error: 'origem é obrigatória',
      };
    }

    if (!parameters.destination) {
      return {
        ok: false,
        module: 'rides',
        intent: 'request_ride',
        parameters,
        error: 'destino é obrigatório',
      };
    }

    // Sem fallback de meio: decisão de vehicleType não pertence ao orchestrator (RFC_UNIFIED_LOGISTICS_MODEL; RFC_LEI_LOGISTICA_UNIFICARD).
    const vehicleType = parameters.vehicleType;
    if (
      vehicleType === undefined ||
      vehicleType === null ||
      (typeof vehicleType === 'string' && vehicleType.trim() === '')
    ) {
      return {
        ok: false,
        module: 'rides',
        intent: 'request_ride',
        parameters,
        error:
          'vehicleType é obrigatório: deve ser enviado pelo cliente ou obtido do logistics planner (integração pendente).',
      };
    }

    // Montar payload
    const payload = {
      origin: parameters.origin,
      destination: parameters.destination,
      vehicleType,
      scheduledTime: parameters.scheduledTime, // opcional para agendamento
      paymentMethod: parameters.paymentMethod,
      notes: parameters.notes,
    };

    // Chamar módulo rides
    // TODO: Implementar chamada real quando módulo rides estiver completo
    return {
      ok: false,
      module: 'rides',
      intent: 'request_ride',
      parameters,
      error: 'INTENT_EXECUTOR_NOT_IMPLEMENTED: a intencao request_ride ainda nao esta ligada ao modulo rides. Nada foi criado, reservado ou cobrado.',
    };
  } catch (error) {
    return {
      ok: false,
      module: 'rides',
      intent: 'request_ride',
      parameters,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Executa intent: book_event
 * Reserva ingressos ou sessões de eventos
 */
export async function executeBookEvent(
  fastify: FastifyInstance,
  parameters: Record<string, any>,
  userId: string,
  tenantId: string
): Promise<ExecutorResult> {
  try {
    // Validar parâmetros
    if (!parameters.eventId && !parameters.eventName) {
      return {
        ok: false,
        module: 'events',
        intent: 'book_event',
        parameters,
        error: 'eventId ou eventName é obrigatório',
      };
    }

    // Montar payload
    const payload = {
      eventId: parameters.eventId,
      eventName: parameters.eventName,
      sessionId: parameters.sessionId,
      quantity: parameters.quantity || 1,
      ticketType: parameters.ticketType,
    };

    // Chamar módulo events
    // TODO: Implementar chamada real quando módulo events tiver endpoint de check-in/booking
    return {
      ok: false,
      module: 'events',
      intent: 'book_event',
      parameters,
      error: 'INTENT_EXECUTOR_NOT_IMPLEMENTED: a intencao book_event ainda nao esta ligada ao modulo events. Nada foi criado, reservado ou cobrado.',
    };
  } catch (error) {
    return {
      ok: false,
      module: 'events',
      intent: 'book_event',
      parameters,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Executa intent: search_local
 * Busca empresas e serviços locais
 */
export async function executeSearchLocal(
  fastify: FastifyInstance,
  parameters: Record<string, any>,
  userId: string,
  tenantId: string
): Promise<ExecutorResult> {
  try {
    // Validar parâmetros
    if (!parameters.query && !parameters.categoryId && !parameters.category) {
      return {
        ok: false,
        module: 'marketplace',
        intent: 'search_local',
        parameters,
        error: 'query, categoryId ou category é obrigatório',
      };
    }

    // Buscar categoria se fornecido como string
    let categoryId = parameters.categoryId;
    if (!categoryId && parameters.category) {
      const categories = await categoriesService.searchCategories(parameters.category, 1, undefined, 'professional');
      if (categories.length > 0) {
        categoryId = categories[0].categoryId;
      }
    }

    // Montar payload
    const payload = {
      query: parameters.query,
      categoryId,
      location: parameters.location,
      radius: parameters.radius || 5000, // metros
      filters: {
        minRating: parameters.minRating,
        openNow: parameters.openNow,
      },
    };

    // Chamar módulo marketplace
    // TODO: Implementar chamada real quando módulo marketplace existir
    return {
      ok: false,
      module: 'marketplace',
      intent: 'search_local',
      parameters,
      error: 'INTENT_EXECUTOR_NOT_IMPLEMENTED: a intencao search_local ainda nao esta ligada ao modulo marketplace. Nada foi criado, reservado ou cobrado.',
    };
  } catch (error) {
    return {
      ok: false,
      module: 'marketplace',
      intent: 'search_local',
      parameters,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Executa intent: delivery_pickup
 * Solicita entrega ou busca de itens
 */
export async function executeDeliveryPickup(
  fastify: FastifyInstance,
  parameters: Record<string, any>,
  userId: string,
  tenantId: string
): Promise<ExecutorResult> {
  try {
    // Validar parâmetros
    const type = parameters.type || 'delivery'; // delivery ou pickup

    if (type === 'delivery' && !parameters.destination) {
      return {
        ok: false,
        module: 'delivery',
        intent: 'delivery_pickup',
        parameters,
        error: 'destino é obrigatório para entrega',
      };
    }

    if (type === 'pickup' && !parameters.origin) {
      return {
        ok: false,
        module: 'delivery',
        intent: 'delivery_pickup',
        parameters,
        error: 'origem é obrigatória para busca',
      };
    }

    // Montar payload
    const payload = {
      type,
      origin: parameters.origin,
      destination: parameters.destination,
      items: parameters.items || [],
      scheduledTime: parameters.scheduledTime,
      paymentMethod: parameters.paymentMethod,
      notes: parameters.notes,
    };

    // Chamar módulo delivery
    // TODO: Implementar chamada real quando módulo delivery existir
    return {
      ok: false,
      module: 'delivery',
      intent: 'delivery_pickup',
      parameters,
      error: 'INTENT_EXECUTOR_NOT_IMPLEMENTED: a intencao delivery_pickup ainda nao esta ligada ao modulo delivery. Nada foi criado, reservado ou cobrado.',
    };
  } catch (error) {
    return {
      ok: false,
      module: 'delivery',
      intent: 'delivery_pickup',
      parameters,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Executa intent: post_content
 * Cria ou compartilha conteúdo social
 */
export async function executePostContent(
  fastify: FastifyInstance,
  parameters: Record<string, any>,
  userId: string,
  tenantId: string
): Promise<ExecutorResult> {
  try {
    // Validar parâmetros
    if (!parameters.content && !parameters.text) {
      return {
        ok: false,
        module: 'marketplace',
        intent: 'post_content',
        parameters,
        error: 'conteúdo é obrigatório',
      };
    }

    // Buscar categoria se fornecido
    let categoryId = parameters.categoryId;
    if (!categoryId && parameters.category) {
      const categories = await categoriesService.searchCategories(parameters.category, 1, undefined, 'professional');
      if (categories.length > 0) {
        categoryId = categories[0].categoryId;
      }
    }

    // Montar payload
    const payload = {
      content: parameters.content || parameters.text,
      categoryId,
      media: parameters.media || [],
      visibility: parameters.visibility || 'public',
      tags: parameters.tags || [],
    };

    // Chamar módulo marketplace
    // TODO: Implementar chamada real quando módulo marketplace tiver endpoint de posts
    return {
      ok: false,
      module: 'marketplace',
      intent: 'post_content',
      parameters,
      error: 'INTENT_EXECUTOR_NOT_IMPLEMENTED: a intencao post_content ainda nao esta ligada ao modulo marketplace. Nada foi criado, reservado ou cobrado.',
    };
  } catch (error) {
    return {
      ok: false,
      module: 'marketplace',
      intent: 'post_content',
      parameters,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Executa intent: ask_question
 * Responde pergunta geral usando AI Kernel
 */
export async function executeAskQuestion(
  fastify: FastifyInstance,
  parameters: Record<string, any>,
  userId: string,
  tenantId: string
): Promise<ExecutorResult> {
  try {
    // Validar parâmetros
    if (!parameters.question && !parameters.text) {
      return {
        ok: false,
        module: 'orchestrator',
        intent: 'ask_question',
        parameters,
        error: 'pergunta é obrigatória',
      };
    }

    const question = parameters.question || parameters.text;

    // Usar AI Kernel para responder
    const aiKernel = fastify.ai;
    const answer = await aiKernel.run(`Responda a seguinte pergunta do usuário: ${question}`, {
      userId,
      tenantId,
      task: 'answer_question',
    });

    return {
      ok: true,
      module: 'orchestrator',
      intent: 'ask_question',
      parameters,
      result: {
        message: 'Pergunta respondida',
        question,
        answer: (answer as any).result || (answer as any).output || 'Resposta não disponível',
        source: 'ai_kernel',
      },
    };
  } catch (error) {
    return {
      ok: false,
      module: 'orchestrator',
      intent: 'ask_question',
      parameters,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Executa intent: support
 * Abre chamado de suporte
 */
export async function executeSupport(
  fastify: FastifyInstance,
  parameters: Record<string, any>,
  userId: string,
  tenantId: string
): Promise<ExecutorResult> {
  try {
    // Validar parâmetros
    if (!parameters.issue && !parameters.message && !parameters.subject) {
      return {
        ok: false,
        module: 'identity',
        intent: 'support',
        parameters,
        error: 'assunto, mensagem ou issue é obrigatório',
      };
    }

    // Montar payload
    const payload = {
      subject: parameters.subject || parameters.issue || 'Suporte',
      message: parameters.message || parameters.issue,
      category: parameters.category || 'general',
      priority: parameters.priority || 'normal',
      attachments: parameters.attachments || [],
    };

    // Chamar módulo identity
    // TODO: Implementar chamada real quando módulo identity tiver endpoint de suporte
    return {
      ok: false,
      module: 'identity',
      intent: 'support',
      parameters,
      error: 'INTENT_EXECUTOR_NOT_IMPLEMENTED: a intencao support ainda nao esta ligada ao modulo identity. Nenhum chamado foi aberto.',
    };
  } catch (error) {
    return {
      ok: false,
      module: 'identity',
      intent: 'support',
      parameters,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Mapeamento de intents para executores
 */
export const INTENT_EXECUTORS: Record<string, (fastify: FastifyInstance, params: Record<string, any>, userId: string, tenantId: string) => Promise<ExecutorResult>> = {
  hire_service: executeHireService,
  schedule_service: executeScheduleService,
  order_food: executeOrderFood,
  buy_product: executeBuyProduct,
  request_ride: executeRequestRide,
  book_event: executeBookEvent,
  search_local: executeSearchLocal,
  delivery_pickup: executeDeliveryPickup,
  post_content: executePostContent,
  ask_question: executeAskQuestion,
  support: executeSupport,
};

