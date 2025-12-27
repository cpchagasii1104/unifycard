// src/utils/intent-classifier.ts
// Classificador de intent local (rápido, sem depender de backend)
// Pode ser melhorado com chamada ao backend depois

type ActorType = 'user' | 'page' | 'group' | 'channel' | null;

export type OccupancyType = 'TABLE' | 'PERSON' | 'SLOT' | 'HYBRID';

export interface ClassifiedIntent {
  intent: 'personal' | 'friends' | 'booking' | 'service_offer' | 'product_offer' | 'project' | 'vote' | 'event';
  eventSubtype?: 'SHOW' | 'CINEMA' | 'ESPORTE' | 'BAR' | 'RESTAURANTE' | 'FEIRA' | 'WORKSHOP' | 'EXPOSICAO' | 'FESTIVAL' | 'BALADA';
  audience?: 'public' | 'friends' | 'company' | 'group';
  dateTime?: string; // ISO string
  price?: number;
  ctaType?: 'booking' | 'service' | 'payment';
  // NOVO: Sugestão de modelo de ocupação
  occupancyModel?: {
    type: OccupancyType;
    confidence: number;
    reasoning: string;
    requiresReservation?: boolean;
    reservationPrice?: number;
  };
  confidence: number;
}

/**
 * Classifica intent a partir de texto livre
 * Versão local simples - pode ser melhorada com backend depois
 */
export async function classifyPostIntent(
  text: string,
  actorType: ActorType = 'user'
): Promise<ClassifiedIntent> {
  const lowerText = text.toLowerCase();
  
  // Extrair data/hora
  const dateTime = extractDateTime(text);
  
  // Extrair preço
  const price = extractPrice(text);
  
  // Classificar tipo de evento (se for evento)
  const eventSubtype = classifyEventSubtype(lowerText);
  
  // Determinar intent principal
  let intent: ClassifiedIntent['intent'] = 'personal';
  let confidence = 0.5;
  let ctaType: ClassifiedIntent['ctaType'] | undefined;
  let audience: ClassifiedIntent['audience'] = 'public';

  // EVENTO
  if (
    eventSubtype ||
    /(evento|show|concerto|festival|feira|workshop|exposição|balada|festa|comemoração)/i.test(text) ||
    /(sábado|domingo|sexta|sabado|dom|sex)/i.test(text) && /(às|as|h|horas?|hora)/i.test(text)
  ) {
    intent = 'event';
    confidence = eventSubtype ? 0.85 : 0.7;
    ctaType = price ? 'payment' : 'booking';
    audience = 'public';
  }
  // AGENDAMENTO
  else if (
    /(agendar|marcar|reservar|agendamento|consulta|sessão)/i.test(text) ||
    /(disponível|horário|horario|aberto)/i.test(text) && /(às|as|h|horas?)/i.test(text)
  ) {
    intent = 'booking';
    confidence = 0.8;
    ctaType = 'booking';
    audience = actorType === 'page' ? 'public' : 'friends';
  }
  // SERVIÇO
  else if (
    /(contratar|serviço|servico|ofereço|ofereco|fazer|realizar)/i.test(text) &&
    !/(produto|vender|venda|comprar)/i.test(text)
  ) {
    intent = 'service_offer';
    confidence = 0.75;
    ctaType = price ? 'payment' : 'service';
    audience = 'public';
  }
  // PRODUTO
  else if (
    /(vender|venda|comprar|produto|preço|preco|r\$|reais?)/i.test(text) ||
    price !== undefined
  ) {
    intent = 'product_offer';
    confidence = 0.8;
    ctaType = 'payment';
    audience = 'public';
  }
  // VOTAÇÃO
  else if (
    /(votar|votação|votacao|escolher|prefer|opção|opcao)/i.test(text) &&
    /(ou|entre|qual)/i.test(text)
  ) {
    intent = 'vote';
    confidence = 0.7;
    audience = actorType === 'page' ? 'company' : 'friends';
  }
  // PROJETO
  else if (
    /(projeto|grupo|colaborar|contribuir|orçamento|orcamento)/i.test(text)
  ) {
    intent = 'project';
    confidence = 0.65;
    ctaType = 'payment';
    audience = 'group';
  }
  // PESSOAL / AMIGOS
  else if (
    /(amigos|pessoal|pessoas próximas|close friends)/i.test(text)
  ) {
    intent = 'friends';
    confidence = 0.6;
    audience = 'friends';
  }
  // PADRÃO: PESSOAL
  else {
    intent = 'personal';
    confidence = 0.5;
    audience = actorType === 'page' ? 'public' : 'friends';
  }

  // Se for evento, sugerir modelo de ocupação
  let occupancyModel: ClassifiedIntent['occupancyModel'] | undefined;
  if (intent === 'event') {
    occupancyModel = suggestOccupancyModel(eventSubtype, lowerText, price);
  }

  return {
    intent,
    eventSubtype,
    audience,
    dateTime,
    price,
    ctaType,
    occupancyModel,
    confidence,
  };
}

/**
 * Sugere modelo de ocupação baseado no tipo de evento e contexto
 */
function suggestOccupancyModel(
  eventSubtype: ClassifiedIntent['eventSubtype'],
  text: string,
  price?: number
): ClassifiedIntent['occupancyModel'] | undefined {
  // RESTAURANTE → Por MESA
  if (eventSubtype === 'RESTAURANTE' || /(restaurante|jantar|almoço|almoco|mesa|mesas)/i.test(text)) {
    return {
      type: 'TABLE',
      confidence: 0.9,
      reasoning: 'Restaurante geralmente usa reserva por mesa',
      requiresReservation: true,
      reservationPrice: price || undefined,
    };
  }

  // BAR → Por PESSOA (em pé) ou HÍBRIDO
  if (eventSubtype === 'BAR' || /(bar|happy hour|drinks|cerveja)/i.test(text)) {
    // Se mencionar mesas, é híbrido
    if (/(mesa|mesas|reservar mesa)/i.test(text)) {
      return {
        type: 'HYBRID',
        confidence: 0.8,
        reasoning: 'Bar com mesas e área em pé',
        requiresReservation: true,
        reservationPrice: price || undefined,
      };
    }
    return {
      type: 'PERSON',
      confidence: 0.85,
      reasoning: 'Bar geralmente é em pé',
      requiresReservation: false,
      reservationPrice: price || undefined,
    };
  }

  // SHOW / FESTIVAL → Por PESSOA (ingresso)
  if (eventSubtype === 'SHOW' || eventSubtype === 'FESTIVAL' || /(show|concerto|festival|ingresso)/i.test(text)) {
    return {
      type: 'PERSON',
      confidence: 0.9,
      reasoning: 'Show usa ingresso por pessoa',
      requiresReservation: !!price,
      reservationPrice: price || undefined,
    };
  }

  // WORKSHOP / CONSULTA → Por SLOT (agenda)
  if (eventSubtype === 'WORKSHOP' || /(workshop|curso|oficina|consulta|agendamento|sessão|sessao)/i.test(text)) {
    return {
      type: 'SLOT',
      confidence: 0.85,
      reasoning: 'Workshop/consulta usa agenda por horário',
      requiresReservation: true,
      reservationPrice: price || undefined,
    };
  }

  // Padrão: Por PESSOA
  return {
    type: 'PERSON',
    confidence: 0.6,
    reasoning: 'Modelo padrão para eventos',
    requiresReservation: !!price,
    reservationPrice: price || undefined,
  };
}

/**
 * Extrai data/hora do texto
 */
function extractDateTime(text: string): string | undefined {
  // Padrões comuns em português
  const patterns = [
    // "sábado às 17h"
    /(sábado|sabado|domingo|segunda|terça|terca|quarta|quinta|sexta)\s+(?:às|as|as|a)\s+(\d{1,2})(?:h|horas?)?/i,
    // "17/12 às 19h"
    /(\d{1,2}\/\d{1,2})(?:\/\d{4})?\s+(?:às|as|a)\s+(\d{1,2})(?:h|horas?)?/i,
    // "hoje às 18h"
    /(hoje|amanhã|amanha)\s+(?:às|as|a)\s+(\d{1,2})(?:h|horas?)?/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const now = new Date();
      let date = new Date(now);

      // Processar dia da semana
      if (match[1]) {
        const dayName = match[1].toLowerCase();
        const dayMap: Record<string, number> = {
          'domingo': 0, 'segunda': 1, 'terça': 2, 'terca': 2,
          'quarta': 3, 'quinta': 4, 'sexta': 5, 'sábado': 6, 'sabado': 6,
        };
        
        if (dayMap[dayName] !== undefined) {
          const targetDay = dayMap[dayName];
          const currentDay = now.getDay();
          const daysUntil = (targetDay - currentDay + 7) % 7 || 7;
          date.setDate(now.getDate() + daysUntil);
        } else if (dayName === 'hoje') {
          date = new Date(now);
        } else if (dayName === 'amanhã' || dayName === 'amanha') {
          date.setDate(now.getDate() + 1);
        }
      }

      // Processar hora
      if (match[2]) {
        const hour = parseInt(match[2], 10);
        date.setHours(hour, 0, 0, 0);
      }

      return date.toISOString();
    }
  }

  return undefined;
}

/**
 * Extrai preço do texto
 */
function extractPrice(text: string): number | undefined {
  // Padrões: R$ 50, R$ 50,00, 50 reais, etc.
  const patterns = [
    /r\$\s*(\d+(?:[.,]\d{2})?)/i,
    /(\d+(?:[.,]\d{2})?)\s*reais?/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const priceStr = match[1].replace(',', '.');
      const price = parseFloat(priceStr);
      if (!isNaN(price) && price > 0) {
        return price;
      }
    }
  }

  return undefined;
}

/**
 * Classifica subtipo de evento
 */
function classifyEventSubtype(text: string): ClassifiedIntent['eventSubtype'] | undefined {
  const patterns: Array<[RegExp, ClassifiedIntent['eventSubtype']]> = [
    [/show|concerto|música|musica|banda|artista/i, 'SHOW'],
    [/cinema|filme|sessão|sessao/i, 'CINEMA'],
    [/esporte|futebol|futebol|jogo|partida/i, 'ESPORTE'],
    [/bar|cerveja|happy hour|happyhour|drinks/i, 'BAR'],
    [/restaurante|comida|jantar|almoço|almoco|feijoada|prato/i, 'RESTAURANTE'],
    [/feira|exposição|exposicao|stand/i, 'FEIRA'],
    [/workshop|curso|oficina|aula/i, 'WORKSHOP'],
    [/exposição|exposicao|galeria|arte/i, 'EXPOSICAO'],
    [/festival|festival de|evento grande/i, 'FESTIVAL'],
    [/balada|festa|dance|dança|danca/i, 'BALADA'],
  ];

  for (const [pattern, subtype] of patterns) {
    if (pattern.test(text)) {
      return subtype;
    }
  }

  return undefined;
}

