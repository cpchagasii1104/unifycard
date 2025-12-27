// src/modules/social/intent-orchestrator.ai.ts
// Prompts de IA para análise de intenção e extração de dados

import type { AIKernel } from '@core/ai/ai-kernel';
import type {
  SocialIntentType,
  ExtractedData,
  MissingField,
  SuggestedAction,
  ActorContext,
} from './intent-orchestrator.types';

/**
 * Prompt para classificar intenção e extrair dados
 */
export async function analyzeIntentWithAI(
  aiKernel: AIKernel,
  text: string,
  actorContext: ActorContext,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<{
  intentType: SocialIntentType;
  confidence: number;
  extractedData: ExtractedData;
  reasoning: string;
}> {
  const actorInfo = actorContext.isCompany
    ? `Empresa: ${actorContext.actorName || actorContext.actorId}`
    : 'Pessoa Física';

  const historyContext = conversationHistory && conversationHistory.length > 0
    ? `\n\nHistórico da conversa:\n${conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n')}`
    : '';

  const prompt = `Você é um assistente inteligente que ajuda pessoas e empresas a criar posts e eventos em uma rede social.

CONTEXTO:
- Quem está falando: ${actorInfo}
- Tipo de ator: ${actorContext.actorType}${historyContext}

TEXTO DO USUÁRIO:
"${text}"

SUA TAREFA:
Analise o texto e identifique:
1. Tipo de intenção (event, service_offer, product_offer, booking, personal_post, friends_post, project, vote, invitation)
2. Dados extraídos (data, hora, local, preço, tipo de evento, etc.)
3. Confiança da classificação (0-1)

TIPOS DE INTENÇÃO:
- event: Criar evento (show, restaurante, bar, workshop, etc.)
- service_offer: Oferecer serviço profissional
- product_offer: Vender produto
- booking: Agendamento/reserva
- personal_post: Post pessoal simples
- friends_post: Post para amigos
- project: Projeto colaborativo
- vote: Votação/enquete
- invitation: Convite específico

DADOS A EXTRAIR:
- eventSubtype: SHOW, CINEMA, ESPORTE, BAR, RESTAURANTE, FEIRA, WORKSHOP, EXPOSICAO, FESTIVAL, BALADA
- dateTime: Data e hora em formato ISO (ex: "2024-12-25T17:00:00-03:00")
- location: Local do evento
- description: Descrição detalhada
- occupancyType: TABLE (mesas), PERSON (pessoas), SLOT (horários), HYBRID (híbrido)
- capacity: Capacidade total
- tableCount: Número de mesas
- seatsPerTable: Lugares por mesa
- isPaid: Se é pago (true/false)
- price: Preço geral
- pricePerPerson: Preço por pessoa
- pricePerTable: Preço por mesa
- audience: public, friends, company, group
- ctaType: booking, service, payment
- ctaPrice: Preço do CTA

IMPORTANTE:
- Se não encontrar um dado, deixe undefined (não invente)
- Para datas relativas ("sábado", "próxima semana"), calcule a data real baseada em hoje
- Para horários, use formato 24h
- Seja conservador na confiança (só alta se tiver certeza)

Retorne APENAS um JSON válido no formato:
{
  "intentType": "event",
  "confidence": 0.9,
  "extractedData": {
    "eventSubtype": "RESTAURANTE",
    "dateTime": "2024-12-28T17:00:00-03:00",
    "location": "Casa do usuário",
    "isPaid": false,
    "occupancyType": "TABLE"
  },
  "reasoning": "Usuário quer criar evento de restaurante (churrasco) em casa no sábado às 17h"
}`;

  try {
    const result = await aiKernel.run(prompt, {
      text,
      actorContext,
      task: 'analyze_social_intent',
    });

    // Parse do resultado
    let parsed: any;
    if (typeof result.result === 'string') {
      const jsonMatch = result.result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Resposta da IA não contém JSON válido');
      }
    } else {
      parsed = result.result;
    }

    return {
      intentType: parsed.intentType as SocialIntentType,
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
      extractedData: parsed.extractedData || {},
      reasoning: parsed.reasoning || 'Análise realizada',
    };
  } catch (error) {
    console.error('Erro ao analisar intent com IA:', error);
    // Fallback: tentar classificação simples
    return {
      intentType: 'personal_post',
      confidence: 0.3,
      extractedData: {},
      reasoning: 'Erro ao analisar com IA, usando classificação básica',
    };
  }
}

/**
 * Identifica campos faltantes baseado na intenção e dados extraídos
 */
export function identifyMissingFields(
  intentType: SocialIntentType,
  extractedData: ExtractedData,
  actorContext: ActorContext
): MissingField[] {
  const missing: MissingField[] = [];

  if (intentType === 'event') {
    if (!extractedData.dateTime) {
      missing.push({
        field: 'dateTime',
        fieldLabel: 'Data e Hora',
        fieldType: 'date',
        question: 'Quando será o evento?',
        required: true,
        reasoning: 'Eventos precisam de data e hora definidas',
      });
    }

    if (!extractedData.eventSubtype) {
      missing.push({
        field: 'eventSubtype',
        fieldLabel: 'Tipo de Evento',
        fieldType: 'select',
        question: 'Que tipo de evento é?',
        options: ['SHOW', 'CINEMA', 'ESPORTE', 'BAR', 'RESTAURANTE', 'FEIRA', 'WORKSHOP', 'EXPOSICAO', 'FESTIVAL', 'BALADA'],
        required: false,
        reasoning: 'Tipo de evento ajuda a sugerir ocupação e CTA corretos',
      });
    }

    if (!extractedData.occupancyType) {
      missing.push({
        field: 'occupancyType',
        fieldLabel: 'Como as pessoas participam?',
        fieldType: 'select',
        question: 'Como as pessoas vão participar? Por mesa, por pessoa, por horário ou híbrido?',
        options: ['TABLE', 'PERSON', 'SLOT', 'HYBRID'],
        required: false,
        reasoning: 'Necessário para gerenciar capacidade e reservas',
      });
    }

    if (extractedData.isPaid && !extractedData.price && !extractedData.pricePerPerson && !extractedData.pricePerTable) {
      missing.push({
        field: 'price',
        fieldLabel: 'Preço',
        fieldType: 'number',
        question: 'Qual o preço?',
        required: false,
        reasoning: 'Evento é pago mas preço não foi informado',
      });
    }
  }

  if (intentType === 'service_offer' || intentType === 'product_offer') {
    if (!extractedData.servicePrice && !extractedData.price) {
      missing.push({
        field: 'price',
        fieldLabel: 'Preço',
        fieldType: 'number',
        question: 'Qual o preço?',
        required: false,
        reasoning: 'Oferta precisa de preço',
      });
    }
  }

  if (intentType === 'booking') {
    if (!extractedData.dateTime) {
      missing.push({
        field: 'dateTime',
        fieldLabel: 'Data e Hora',
        fieldType: 'date',
        question: 'Quando será o agendamento?',
        required: true,
        reasoning: 'Agendamento precisa de data e hora',
      });
    }
  }

  return missing;
}

/**
 * Gera ações sugeridas baseadas na análise
 */
export function generateSuggestedActions(
  intentType: SocialIntentType,
  extractedData: ExtractedData,
  missingFields: MissingField[]
): SuggestedAction[] {
  const actions: SuggestedAction[] = [];

  if (intentType === 'event' && missingFields.length === 0) {
    actions.push({
      action: 'create_event',
      actionLabel: 'Criar Evento',
      canExecute: true,
      requiresConfirmation: true,
      payload: {
        subtype: extractedData.eventSubtype,
        dateTime: extractedData.dateTime,
        location: extractedData.location,
        description: extractedData.description,
        occupancyType: extractedData.occupancyType,
        capacity: extractedData.capacity,
        tableCount: extractedData.tableCount,
        seatsPerTable: extractedData.seatsPerTable,
        isPaid: extractedData.isPaid,
        price: extractedData.price,
        pricePerPerson: extractedData.pricePerPerson,
        pricePerTable: extractedData.pricePerTable,
        audience: extractedData.audience || 'public',
      },
      description: 'Criar evento com os dados extraídos',
      reasoning: 'Todos os dados necessários foram identificados',
    });
  }

  if (intentType === 'service_offer' && missingFields.length === 0) {
    actions.push({
      action: 'create_service_post',
      actionLabel: 'Criar Post de Serviço',
      canExecute: true,
      requiresConfirmation: true,
      payload: {
        serviceType: extractedData.serviceType,
        price: extractedData.servicePrice || extractedData.price,
        description: extractedData.description,
      },
      description: 'Criar post oferecendo serviço',
      reasoning: 'Dados suficientes para criar post de serviço',
    });
  }

  if (intentType === 'product_offer' && missingFields.length === 0) {
    actions.push({
      action: 'create_product_post',
      actionLabel: 'Criar Post de Produto',
      canExecute: true,
      requiresConfirmation: true,
      payload: {
        productName: extractedData.productName,
        price: extractedData.price,
        description: extractedData.description,
      },
      description: 'Criar post vendendo produto',
      reasoning: 'Dados suficientes para criar post de produto',
    });
  }

  return actions;
}

/**
 * Gera mensagem amigável para o usuário
 */
export function generateUserMessage(
  intentType: SocialIntentType,
  missingFields: MissingField[],
  extractedData: ExtractedData
): string {
  if (missingFields.length === 0) {
    if (intentType === 'event') {
      return `Perfeito! Entendi que você quer criar um evento${extractedData.eventSubtype ? ` do tipo ${extractedData.eventSubtype}` : ''}${extractedData.dateTime ? ` em ${new Date(extractedData.dateTime).toLocaleString('pt-BR')}` : ''}. Posso criar agora?`;
    }
    return 'Entendi! Posso criar isso para você. Deseja continuar?';
  }

  const firstMissing = missingFields[0];
  return firstMissing.question;
}













