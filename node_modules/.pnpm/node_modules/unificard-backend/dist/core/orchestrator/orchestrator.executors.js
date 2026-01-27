"use strict";
// src/core/orchestrator/orchestrator.executors.ts
// Intent Execution Engine - Executores reais para cada intent
Object.defineProperty(exports, "__esModule", { value: true });
exports.INTENT_EXECUTORS = void 0;
exports.executeHireService = executeHireService;
exports.executeScheduleService = executeScheduleService;
exports.executeOrderFood = executeOrderFood;
exports.executeBuyProduct = executeBuyProduct;
exports.executeRequestRide = executeRequestRide;
exports.executeBookEvent = executeBookEvent;
exports.executeSearchLocal = executeSearchLocal;
exports.executeDeliveryPickup = executeDeliveryPickup;
exports.executePostContent = executePostContent;
exports.executeAskQuestion = executeAskQuestion;
exports.executeSupport = executeSupport;
const categories_service_1 = require("../categories/categories.service");
/**
 * Executa intent: hire_service
 * Contrata um serviço profissional
 */
async function executeHireService(fastify, parameters, userId, tenantId) {
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
            const categories = await categories_service_1.categoriesService.searchCategories(serviceType, 1, undefined, 'professional');
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
            ok: true,
            module: 'work',
            intent: 'hire_service',
            parameters,
            result: {
                message: 'Busca de profissionais iniciada',
                payload,
                workers: [], // Placeholder
            },
        };
    }
    catch (error) {
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
async function executeScheduleService(fastify, parameters, userId, tenantId) {
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
            ok: true,
            module: 'work',
            intent: 'schedule_service',
            parameters,
            result: {
                message: 'Agendamento criado',
                payload,
                appointmentId: 'placeholder-id',
            },
        };
    }
    catch (error) {
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
async function executeOrderFood(fastify, parameters, userId, tenantId) {
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
            ok: true,
            module: 'commerce',
            intent: 'order_food',
            parameters,
            result: {
                message: 'Pedido criado',
                payload,
                orderId: 'placeholder-id',
            },
        };
    }
    catch (error) {
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
async function executeBuyProduct(fastify, parameters, userId, tenantId) {
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
            const categories = await categories_service_1.categoriesService.searchCategories(parameters.category, 1, undefined, 'professional');
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
            ok: true,
            module: 'commerce',
            intent: 'buy_product',
            parameters,
            result: {
                message: 'Produto adicionado ao carrinho',
                payload,
                cartItemId: 'placeholder-id',
            },
        };
    }
    catch (error) {
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
async function executeRequestRide(fastify, parameters, userId, tenantId) {
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
        // Montar payload
        const payload = {
            origin: parameters.origin,
            destination: parameters.destination,
            vehicleType: parameters.vehicleType || 'car', // car, motorcycle, etc
            scheduledTime: parameters.scheduledTime, // opcional para agendamento
            paymentMethod: parameters.paymentMethod,
            notes: parameters.notes,
        };
        // Chamar módulo rides
        // TODO: Implementar chamada real quando módulo rides estiver completo
        return {
            ok: true,
            module: 'rides',
            intent: 'request_ride',
            parameters,
            result: {
                message: 'Corrida solicitada',
                payload,
                rideId: 'placeholder-id',
                estimatedArrival: '5 minutos',
            },
        };
    }
    catch (error) {
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
async function executeBookEvent(fastify, parameters, userId, tenantId) {
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
            ok: true,
            module: 'events',
            intent: 'book_event',
            parameters,
            result: {
                message: 'Check-in realizado no evento',
                payload,
                checkInTime: new Date().toISOString(),
            },
        };
    }
    catch (error) {
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
async function executeSearchLocal(fastify, parameters, userId, tenantId) {
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
            const categories = await categories_service_1.categoriesService.searchCategories(parameters.category, 1, undefined, 'professional');
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
            ok: true,
            module: 'marketplace',
            intent: 'search_local',
            parameters,
            result: {
                message: 'Busca realizada',
                payload,
                results: [], // Placeholder
            },
        };
    }
    catch (error) {
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
async function executeDeliveryPickup(fastify, parameters, userId, tenantId) {
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
            ok: true,
            module: 'delivery',
            intent: 'delivery_pickup',
            parameters,
            result: {
                message: `${type === 'delivery' ? 'Entrega' : 'Busca'} solicitada`,
                payload,
                deliveryId: 'placeholder-id',
            },
        };
    }
    catch (error) {
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
async function executePostContent(fastify, parameters, userId, tenantId) {
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
            const categories = await categories_service_1.categoriesService.searchCategories(parameters.category, 1, undefined, 'professional');
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
            ok: true,
            module: 'marketplace',
            intent: 'post_content',
            parameters,
            result: {
                message: 'Postagem criada',
                payload,
                postId: 'placeholder-id',
            },
        };
    }
    catch (error) {
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
async function executeAskQuestion(fastify, parameters, userId, tenantId) {
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
                answer: answer.result || answer.output || 'Resposta não disponível',
                source: 'ai_kernel',
            },
        };
    }
    catch (error) {
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
async function executeSupport(fastify, parameters, userId, tenantId) {
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
            ok: true,
            module: 'identity',
            intent: 'support',
            parameters,
            result: {
                message: 'Chamado de suporte criado',
                payload,
                ticketId: 'placeholder-id',
            },
        };
    }
    catch (error) {
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
exports.INTENT_EXECUTORS = {
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
