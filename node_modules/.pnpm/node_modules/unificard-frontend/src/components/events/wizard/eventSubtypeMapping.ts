// eventSubtypeMapping.ts
// Mapeamento de intenções para subtipos específicos de eventos
// Permite personalização adequada do wizard adaptativo

import type { EventSubtype } from '../../../types/event-wizard';
import type { Intention } from './intentionMapping';

export interface EventSubtypeOption {
  value: EventSubtype;
  label: string;
  description: string;
  icon: string;
}

// Mapeamento de intenções para subtipos possíveis
export const INTENTION_TO_SUBTYPES: Record<Intention, EventSubtypeOption[]> = {
  // Celebrar algo -> Lista canônica de subtipos de celebração
  celebrate: [
    {
      value: 'birthday',
      label: 'Aniversário',
      description: 'Festa de aniversário (infantil, 15 anos, adulto)',
      icon: '🎂',
    },
    {
      value: 'wedding',
      label: 'Casamento',
      description: 'Cerimônia e festa de casamento',
      icon: '💍',
    },
    {
      value: 'graduation',
      label: 'Formatura',
      description: 'Cerimônia de formatura e comemoração',
      icon: '🎓',
    },
    {
      value: 'baptism',
      label: 'Batizado',
      description: 'Cerimônia de batizado e celebração',
      icon: '👶',
    },
    {
      value: 'anniversary',
      label: 'Bodas',
      description: 'Celebração de aniversário de casamento',
      icon: '💑',
    },
    {
      value: 'baby_shower',
      label: 'Chá de Bebê',
      description: 'Festa de chá de bebê',
      icon: '🎁',
    },
    {
      value: 'gender_reveal',
      label: 'Revelação de Gênero',
      description: 'Festa para revelar o gênero do bebê',
      icon: '🎊',
    },
    {
      value: 'engagement',
      label: 'Noivado',
      description: 'Festa de noivado e pedido de casamento',
      icon: '💎',
    },
    {
      value: 'other',
      label: 'Outro tipo de celebração',
      description: 'Outro tipo de celebração não listado',
      icon: '🎉',
    },
  ],
  
  // Reunir pessoas -> Encontros, happy hours, aniversários
  gather: [
    {
      value: 'birthday',
      label: 'Aniversário',
      description: 'Festa de aniversário',
      icon: '🎂',
    },
    {
      value: 'other',
      label: 'Encontro social',
      description: 'Happy hour, encontro de amigos, etc.',
      icon: '👥',
    },
  ],
  
  // Ensinar algo -> Workshops, aulas, mentorias
  teach: [
    {
      value: 'workshop',
      label: 'Workshop',
      description: 'Curso prático ou oficina',
      icon: '🔧',
    },
    {
      value: 'conference',
      label: 'Conferência',
      description: 'Palestra ou apresentação',
      icon: '📊',
    },
    {
      value: 'other',
      label: 'Outro',
      description: 'Aula, mentoria, etc.',
      icon: '📚',
    },
  ],
  
  // Apresentar algo -> Shows, exposições, performances
  present: [
    {
      value: 'show',
      label: 'Show',
      description: 'Apresentação musical ou artística',
      icon: '🎤',
    },
    {
      value: 'nightclub',
      label: 'Balada',
      description: 'Evento noturno com música e dança',
      icon: '🎵',
    },
    {
      value: 'festival',
      label: 'Festival',
      description: 'Festival de música ou arte',
      icon: '🎪',
    },
    {
      value: 'other',
      label: 'Outro',
      description: 'Exposição, performance, etc.',
      icon: '🎭',
    },
  ],
  
  // Experiência gastronômica
  gastronomy: [
    {
      value: 'other',
      label: 'Evento gastronômico',
      description: 'Degustação, jantar, food truck, etc.',
      icon: '🍽️',
    },
  ],
  
  // Promover / Divulgar
  promote: [
    {
      value: 'corporate',
      label: 'Evento corporativo',
      description: 'Lançamento, feira, ativação',
      icon: '🏢',
    },
    {
      value: 'other',
      label: 'Outro',
      description: 'Feira, lançamento, etc.',
      icon: '📢',
    },
  ],
  
  // Competir / Desafiar
  compete: [
    {
      value: 'other',
      label: 'Competição',
      description: 'Campeonato, rally, competição',
      icon: '🏆',
    },
  ],
  
  // Inspirar / Conectar
  inspire: [
    {
      value: 'other',
      label: 'Evento espiritual',
      description: 'Retiro, meditação, culto',
      icon: '🙏',
    },
  ],
  
  // Fazer vaquinha
  fundraise: [
    {
      value: 'other',
      label: 'Vaquinha',
      description: 'Rateio, contribuição voluntária',
      icon: '💰',
    },
  ],
};

/**
 * Obtém os subtipos disponíveis para uma intenção
 */
export function getSubtypesForIntention(intention: Intention): EventSubtypeOption[] {
  return INTENTION_TO_SUBTYPES[intention] || [
    {
      value: 'other',
      label: 'Outro',
      description: 'Tipo de evento não especificado',
      icon: '📅',
    },
  ];
}

/**
 * Verifica se uma intenção requer seleção de subtipo
 */
export function requiresSubtypeSelection(intention: Intention): boolean {
  const subtypes = INTENTION_TO_SUBTYPES[intention];
  return subtypes ? subtypes.length > 1 : false;
}

