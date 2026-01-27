// intentionMapping.ts
// Mapeamento de intenções (UX) para event_types (backend)
// ATUALIZADO: 29/12/2024 - Regras de Actor implementadas

export type Intention = 
  | 'present'      // Apresentar algo
  | 'gather'       // Reunir pessoas
  | 'teach'        // Ensinar algo
  | 'celebrate'    // Celebrar algo
  | 'compete'      // Competir / Desafiar
  | 'inspire'      // Inspirar / Conectar
  | 'gastronomy'   // Experiência gastronômica
  | 'promote'      // Promover / Divulgar
  | 'fundraise';   // Fazer vaquinha (novo - apenas PF)

export type EventType = 
  | 'cultural' 
  | 'gastronomic' 
  | 'social' 
  | 'professional' 
  | 'community' 
  | 'spiritual' 
  | 'sports' 
  | 'private';

export interface IntentionCard {
  id: Intention;
  icon: string;
  label: string;
  description: string;
  eventType: EventType;
  // Limites por tipo de actor
  limits: {
    user: { maxAttendees: number | null; note?: string } | null; // null = não permitido
    page: { maxAttendees: number | null; note?: string } | null;
  };
}

export const INTENTION_CARDS: readonly IntentionCard[] = [
  // === OPÇÕES PARA PESSOA FÍSICA (user) ===
  {
    id: 'gather',
    icon: '🎉',
    label: 'Reunir pessoas',
    description: 'Encontros, happy hours, aniversários',
    eventType: 'social',
    limits: {
      user: { maxAttendees: 100, note: 'Máx. 100 pessoas' },
      page: { maxAttendees: null }, // Sem limite para PJ
    },
  },
  {
    id: 'teach',
    icon: '📚',
    label: 'Ensinar algo',
    description: 'Workshops, aulas, mentorias',
    eventType: 'professional',
    limits: {
      user: { maxAttendees: 30, note: 'Máx. 30 pessoas' },
      page: { maxAttendees: null },
    },
  },
  {
    id: 'celebrate',
    icon: '🎊',
    label: 'Celebrar algo',
    description: 'Festas, casamentos, formaturas',
    eventType: 'private',
    limits: {
      user: { maxAttendees: 100, note: 'Máx. 100 pessoas • Privado' },
      page: { maxAttendees: null },
    },
  },
  {
    id: 'fundraise',
    icon: '💰',
    label: 'Fazer vaquinha',
    description: 'Rateio, contribuição voluntária',
    eventType: 'community',
    limits: {
      user: { maxAttendees: null, note: 'Sem limite • Contribuição' },
      page: null, // PJ não precisa de vaquinha
    },
  },
  
  // === OPÇÕES EXCLUSIVAS/EXPANDIDAS PARA PESSOA JURÍDICA (page) ===
  {
    id: 'present',
    icon: '🎭',
    label: 'Apresentar algo',
    description: 'Shows, exposições, performances',
    eventType: 'cultural',
    limits: {
      user: null, // PF não pode criar eventos culturais grandes
      page: { maxAttendees: null },
    },
  },
  {
    id: 'compete',
    icon: '🏆',
    label: 'Competir / Desafiar',
    description: 'Campeonatos, rallys, competições',
    eventType: 'sports',
    limits: {
      user: null, // PF não pode criar competições
      page: { maxAttendees: null },
    },
  },
  {
    id: 'inspire',
    icon: '🙏',
    label: 'Inspirar / Conectar',
    description: 'Retiros, meditações, cultos',
    eventType: 'spiritual',
    limits: {
      user: null, // PF não pode criar eventos espirituais grandes
      page: { maxAttendees: null },
    },
  },
  {
    id: 'gastronomy',
    icon: '🍽️',
    label: 'Experiência gastronômica',
    description: 'Degustações, jantares, food trucks',
    eventType: 'gastronomic',
    limits: {
      user: null, // PF não pode criar eventos gastronômicos comerciais
      page: { maxAttendees: null },
    },
  },
  {
    id: 'promote',
    icon: '📢',
    label: 'Promover / Divulgar',
    description: 'Lançamentos, feiras, ativações',
    eventType: 'community',
    limits: {
      user: null, // PF não pode criar eventos promocionais
      page: { maxAttendees: null },
    },
  },
] as const;

// Helper: filtrar intenções disponíveis para um actor_type
export function getAvailableIntentions(actorType: 'user' | 'page'): IntentionCard[] {
  return INTENTION_CARDS.filter(card => card.limits[actorType] !== null);
}

// Helper: obter limite de participantes para uma intenção e actor
export function getIntentionLimit(intention: Intention, actorType: 'user' | 'page'): { maxAttendees: number | null; note?: string } | null {
  const card = INTENTION_CARDS.find(c => c.id === intention);
  if (!card) return null;
  return card.limits[actorType];
}

// Helper: obter event_type a partir de intention
export function intentionToEventType(intention: Intention): EventType {
  const card = INTENTION_CARDS.find(c => c.id === intention);
  if (!card) {
    throw new Error(`Intention inválida: ${intention}`);
  }
  return card.eventType;
}

// Helper: verificar se PF pode criar evento com cobrança
export function canUserChargeForEvent(intention: Intention): boolean {
  // PF pode cobrar apenas para: gather, teach, celebrate, fundraise
  const chargeableIntentions: Intention[] = ['gather', 'teach', 'celebrate', 'fundraise'];
  return chargeableIntentions.includes(intention);
}

// Constantes de limites para PF (usadas na validação)
export const USER_LIMITS = {
  maxTicketPriceCents: 20000,    // R$ 200,00
  maxTotalValueCents: 1000000,   // R$ 10.000,00
  defaultMaxAttendees: 100,
} as const;
