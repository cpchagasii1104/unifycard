// src/core/events/event.aggregate.ts
// Agregado Event Mínimo (Domínio Magro)
// EVENT_DOMAIN_MINIMUM_CONTRACT

/**
 * 🔴 ANTI-RESPONSABILIDADES DO EVENTO (EVENT_DOMAIN_MINIMUM_CONTRACT Seção 5)
 * 
 * O Evento NUNCA PODE:
 * - ❌ Validar ou bloquear agenda
 * - ❌ Criar ou escrever compromissos na Agenda Universal
 * - ❌ Executar pagamentos ou custódia
 * - ❌ Decidir matching de serviços
 * - ❌ Executar votação
 * - ❌ Avaliar mérito ou disputas
 * - ❌ Inferir categorias por descrição
 * - ❌ Conter regras escondidas em templates
 * 
 * Qualquer código que viole esta lista é inválido.
 */

import type { EventStatus, ActorType, EventVisibility, EventDeclaration } from './event.types';

/**
 * EventAggregate - Agregado canônico mínimo do domínio Event
 * (EVENT_DOMAIN_MINIMUM_CONTRACT Seção 3)
 */
export interface EventAggregate {
  id: string;
  tenantId: string;
  responsibleActorId: string; // Obrigatório, explícito
  responsibleActorType: ActorType;
  status: EventStatus; // Canônico: draft, declared, published, active, ended, cancelled
  visibility: EventVisibility;
  declaration?: EventDeclaration | null;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/**
 * Mapa de transições permitidas (EVENT_DOMAIN_MINIMUM_CONTRACT)
 * 
 * Transições válidas:
 * - draft -> declared
 * - declared -> published
 * - published -> active
 * - active -> ended
 * - * -> cancelled (exceto ended)
 */
const ALLOWED_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  draft: ['declared', 'cancelled'],
  declared: ['published', 'cancelled'],
  published: ['active', 'cancelled'],
  active: ['ended', 'cancelled'],
  ended: [], // ended não pode transicionar
  cancelled: [], // cancelled não pode transicionar
  // Legacy statuses (mapeados para canônicos)
  completed: [], // Legacy: tratado como ended
  archived: [], // Legacy: tratado como ended
};

/**
 * Verifica se uma transição de status é permitida
 */
export function canTransition(from: EventStatus, to: EventStatus): boolean {
  // ended e cancelled não podem transicionar
  if (from === 'ended' || from === 'cancelled') {
    return false;
  }

  // Mapear status legacy para canônico
  const canonicalFrom = mapToCanonicalStatus(from);
  const canonicalTo = mapToCanonicalStatus(to);
  
  const allowed = ALLOWED_TRANSITIONS[canonicalFrom] || [];
  return allowed.includes(canonicalTo);
}

/**
 * Valida e lança erro se transição não for permitida
 */
export function assertTransitionAllowed(from: EventStatus, to: EventStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Transição de status inválida: '${from}' -> '${to}'. ` +
      `Transições permitidas de '${from}': ${ALLOWED_TRANSITIONS[mapToCanonicalStatus(from)]?.join(', ') || 'nenhuma'}`
    );
  }
}

/**
 * Mapeia status legacy para canônico
 */
function mapToCanonicalStatus(status: EventStatus): EventStatus {
  switch (status) {
    case 'completed':
      return 'ended';
    case 'archived':
      return 'ended';
    default:
      return status;
  }
}

/**
 * Valida se um status é canônico (não legacy)
 */
export function isCanonicalStatus(status: EventStatus): boolean {
  return !['completed', 'archived'].includes(status);
}

/**
 * Converte EventAggregate para formato de resposta (com aliases)
 */
export function enrichEventWithCanonicalFields(event: {
  id: string;
  tenantId: string;
  actorId: string;
  actorType: ActorType;
  status: EventStatus;
  visibility: EventVisibility;
  declaration?: EventDeclaration | null;
  createdAt: string;
  updatedAt: string;
}): EventAggregate {
  return {
    id: event.id,
    tenantId: event.tenantId,
    responsibleActorId: event.actorId, // Alias canônico
    responsibleActorType: event.actorType,
    status: mapToCanonicalStatus(event.status),
    visibility: event.visibility,
    declaration: event.declaration || null,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
}

