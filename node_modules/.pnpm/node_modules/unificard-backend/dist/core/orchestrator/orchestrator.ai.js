"use strict";
// src/core/orchestrator/orchestrator.ai.ts
// Ponte com AI Kernel para análise de intents
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeIntentWithAI = analyzeIntentWithAI;
exports.generateSuggestedActions = generateSuggestedActions;
exports.generateFlowSteps = generateFlowSteps;
/**
 * Mapeamento de intents para descrições
 */
const INTENT_DESCRIPTIONS = {
    hire_service: 'Contratar um serviço profissional (manicure, pedreiro, mecânico, etc.)',
    buy_product: 'Comprar um produto físico ou digital',
    request_ride: 'Solicitar transporte (carro, moto, táxi)',
    book_event: 'Reservar ingressos ou sessões de eventos',
    schedule_service: 'Agendar um serviço com profissional',
    order_food: 'Pedir comida de restaurante ou lanchonete',
    delivery_pickup: 'Solicitar entrega ou busca de itens',
    search_local: 'Buscar empresas e serviços próximos',
    post_content: 'Criar ou compartilhar conteúdo social',
    ask_question: 'Fazer uma pergunta geral',
    support: 'Solicitar suporte ao usuário',
};
/**
 * Analisa texto usando AI Kernel para identificar intents
 */
async function analyzeIntentWithAI(aiKernel, text, context) {
    const prompt = `Analise o seguinte texto do usuário e identifique as intenções (intents) presentes.

Texto: "${text}"

Intents possíveis:
${Object.entries(INTENT_DESCRIPTIONS)
        .map(([intent, desc]) => `- ${intent}: ${desc}`)
        .join('\n')}

Retorne um JSON com array de intents identificadas, cada uma com:
- intent: tipo da intent
- confidence: confiança de 0 a 1
- parameters: parâmetros extraídos (ex: tipo de serviço, localização, etc.)
- reasoning: breve explicação

Formato esperado:
{
  "intents": [
    {
      "intent": "hire_service",
      "confidence": 0.9,
      "parameters": {
        "serviceType": "manicure",
        "location": "São Paulo"
      },
      "reasoning": "Usuário quer contratar serviço de manicure"
    }
  ]
}`;
    try {
        const result = await aiKernel.run(prompt, {
            text,
            context,
            task: 'analyze_intent',
        });
        // Parse do resultado do AI
        if (result && result.result) {
            let parsed;
            if (typeof result.result === 'string') {
                // Tentar extrair JSON da string
                const jsonMatch = result.result.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    parsed = JSON.parse(jsonMatch[0]);
                }
                else {
                    parsed = { intents: [] };
                }
            }
            else {
                parsed = result.result;
            }
            return (parsed.intents || []).map((i) => ({
                intent: i.intent,
                confidence: Math.max(0, Math.min(1, i.confidence || 0)),
                parameters: i.parameters || {},
                reasoning: i.reasoning,
            }));
        }
        return [];
    }
    catch (error) {
        console.error('Erro ao analisar intent com AI:', error);
        return [];
    }
}
/**
 * Gera ações sugeridas baseadas nas intents identificadas
 */
function generateSuggestedActions(intents, categories) {
    const actions = [];
    for (const intentAnalysis of intents) {
        const { intent, parameters = {} } = intentAnalysis;
        switch (intent) {
            case 'hire_service':
                actions.push({
                    action: 'search_workers',
                    module: 'work',
                    endpoint: '/work/workers/search',
                    payload: {
                        categoryId: categories[0]?.categoryId,
                        serviceType: parameters.serviceType,
                    },
                    description: 'Buscar profissionais disponíveis',
                });
                break;
            case 'buy_product':
                actions.push({
                    action: 'search_products',
                    module: 'commerce',
                    endpoint: '/commerce/products/search',
                    payload: {
                        categoryId: categories[0]?.categoryId,
                        query: parameters.productName,
                    },
                    description: 'Buscar produtos disponíveis',
                });
                break;
            case 'request_ride':
                actions.push({
                    action: 'request_ride',
                    module: 'rides',
                    endpoint: '/rides/request',
                    payload: {
                        origin: parameters.origin,
                        destination: parameters.destination,
                    },
                    description: 'Solicitar transporte',
                });
                break;
            case 'book_event':
                actions.push({
                    action: 'search_events',
                    module: 'events',
                    endpoint: '/events/search',
                    payload: {
                        categoryId: categories[0]?.categoryId,
                        date: parameters.date,
                    },
                    description: 'Buscar eventos disponíveis',
                });
                break;
            case 'schedule_service':
                actions.push({
                    action: 'schedule_service',
                    module: 'work',
                    endpoint: '/work/schedule',
                    payload: {
                        workerId: parameters.workerId,
                        date: parameters.date,
                        time: parameters.time,
                    },
                    description: 'Agendar serviço',
                });
                break;
            case 'order_food':
                actions.push({
                    action: 'search_restaurants',
                    module: 'commerce',
                    endpoint: '/commerce/restaurants/search',
                    payload: {
                        cuisine: parameters.cuisine,
                        location: parameters.location,
                    },
                    description: 'Buscar restaurantes',
                });
                break;
            case 'delivery_pickup':
                actions.push({
                    action: 'request_delivery',
                    module: 'delivery',
                    endpoint: '/delivery/request',
                    payload: {
                        type: parameters.type, // 'delivery' ou 'pickup'
                        origin: parameters.origin,
                        destination: parameters.destination,
                    },
                    description: 'Solicitar entrega ou busca',
                });
                break;
            case 'search_local':
                actions.push({
                    action: 'search_local',
                    module: 'marketplace',
                    endpoint: '/marketplace/search',
                    payload: {
                        query: parameters.query,
                        location: parameters.location,
                        categoryId: categories[0]?.categoryId,
                    },
                    description: 'Buscar empresas e serviços locais',
                });
                break;
            case 'post_content':
                actions.push({
                    action: 'create_post',
                    module: 'marketplace',
                    endpoint: '/marketplace/posts/create',
                    payload: {
                        content: parameters.content,
                        categoryId: categories[0]?.categoryId,
                    },
                    description: 'Criar postagem',
                });
                break;
            case 'ask_question':
                actions.push({
                    action: 'answer_question',
                    module: 'orchestrator',
                    endpoint: '/orchestrator/answer',
                    payload: {
                        question: parameters.question,
                    },
                    description: 'Responder pergunta',
                });
                break;
            case 'support':
                actions.push({
                    action: 'open_support',
                    module: 'identity',
                    endpoint: '/identity/support',
                    payload: {
                        issue: parameters.issue,
                    },
                    description: 'Abrir chamado de suporte',
                });
                break;
        }
    }
    return actions;
}
/**
 * Gera fluxo de próximos passos baseado na intent
 */
function generateFlowSteps(intent) {
    const flows = {
        hire_service: [
            {
                step: 1,
                module: 'categories',
                action: 'identify_service_category',
                description: 'Identificar categoria do serviço',
                required: true,
            },
            {
                step: 2,
                module: 'work',
                action: 'search_workers',
                description: 'Buscar profissionais disponíveis',
                required: true,
            },
            {
                step: 3,
                module: 'work',
                action: 'view_worker_profile',
                description: 'Visualizar perfil do profissional',
                required: false,
            },
            {
                step: 4,
                module: 'work',
                action: 'schedule_service',
                description: 'Agendar serviço',
                required: true,
            },
        ],
        buy_product: [
            {
                step: 1,
                module: 'categories',
                action: 'identify_product_category',
                description: 'Identificar categoria do produto',
                required: true,
            },
            {
                step: 2,
                module: 'commerce',
                action: 'search_products',
                description: 'Buscar produtos',
                required: true,
            },
            {
                step: 3,
                module: 'commerce',
                action: 'add_to_cart',
                description: 'Adicionar ao carrinho',
                required: false,
            },
        ],
        request_ride: [
            {
                step: 1,
                module: 'rides',
                action: 'set_origin',
                description: 'Definir origem',
                required: true,
            },
            {
                step: 2,
                module: 'rides',
                action: 'set_destination',
                description: 'Definir destino',
                required: true,
            },
            {
                step: 3,
                module: 'rides',
                action: 'request_ride',
                description: 'Solicitar corrida',
                required: true,
            },
        ],
        book_event: [
            {
                step: 1,
                module: 'events',
                action: 'search_events',
                description: 'Buscar eventos',
                required: true,
            },
            {
                step: 2,
                module: 'events',
                action: 'view_event_details',
                description: 'Ver detalhes do evento',
                required: false,
            },
            {
                step: 3,
                module: 'events',
                action: 'check_in',
                description: 'Fazer check-in',
                required: true,
            },
        ],
        schedule_service: [
            {
                step: 1,
                module: 'work',
                action: 'select_worker',
                description: 'Selecionar profissional',
                required: true,
            },
            {
                step: 2,
                module: 'work',
                action: 'select_date_time',
                description: 'Selecionar data e horário',
                required: true,
            },
            {
                step: 3,
                module: 'work',
                action: 'confirm_schedule',
                description: 'Confirmar agendamento',
                required: true,
            },
        ],
        order_food: [
            {
                step: 1,
                module: 'commerce',
                action: 'search_restaurants',
                description: 'Buscar restaurantes',
                required: true,
            },
            {
                step: 2,
                module: 'commerce',
                action: 'select_menu_items',
                description: 'Selecionar itens do cardápio',
                required: true,
            },
            {
                step: 3,
                module: 'commerce',
                action: 'place_order',
                description: 'Fazer pedido',
                required: true,
            },
        ],
        delivery_pickup: [
            {
                step: 1,
                module: 'delivery',
                action: 'set_pickup_location',
                description: 'Definir local de coleta',
                required: true,
            },
            {
                step: 2,
                module: 'delivery',
                action: 'set_delivery_location',
                description: 'Definir local de entrega',
                required: true,
            },
            {
                step: 3,
                module: 'delivery',
                action: 'request_delivery',
                description: 'Solicitar entrega',
                required: true,
            },
        ],
        search_local: [
            {
                step: 1,
                module: 'marketplace',
                action: 'search_businesses',
                description: 'Buscar empresas',
                required: true,
            },
            {
                step: 2,
                module: 'marketplace',
                action: 'filter_results',
                description: 'Filtrar resultados',
                required: false,
            },
        ],
        post_content: [
            {
                step: 1,
                module: 'marketplace',
                action: 'create_post',
                description: 'Criar postagem',
                required: true,
            },
        ],
        ask_question: [
            {
                step: 1,
                module: 'orchestrator',
                action: 'answer_question',
                description: 'Responder pergunta',
                required: true,
            },
        ],
        support: [
            {
                step: 1,
                module: 'identity',
                action: 'open_support_ticket',
                description: 'Abrir chamado',
                required: true,
            },
        ],
    };
    return flows[intent] || [];
}
