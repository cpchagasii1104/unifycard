// src/types/unifycard-event.types.ts

/**
 * 🔴 CRÍTICO: Contrato formal de contexto de evento
 * UnifyCard → UnifyBank SEMPRE usa este formato
 */
export interface UnifyCardEventContext {
  // Tipo de módulo
  module: 'EVENT' | 'CONSUMPTION' | 'PARKING';
  
  // Identificação
  entityType: 'event';
  entityId: string; // event_id
  eventType: string; // SHOW, BAR, RESTAURANTE, etc
  
  // Localização (para split regional)
  cityId: string;
  
  // Usuário
  globalUserId: string;
  
  // 🔴 MVP: Consumo herda split do evento
  // parentModule indica que consumo é filho de evento
  parentModule?: 'EVENT'; // Apenas para CONSUMPTION
  
  // Referências opcionais
  ticketId?: string;
  consumptionId?: string;
  parkingId?: string;
  scheduleSlotId?: string;
}

/**
 * Validação em runtime
 */
export function validateEventContext(ctx: any): ctx is UnifyCardEventContext {
  if (!ctx || typeof ctx !== 'object') return false;
  
  const validModules = ['EVENT', 'CONSUMPTION', 'PARKING'];
  if (!validModules.includes(ctx.module)) return false;
  
  if (ctx.entityType !== 'event') return false;
  
  const requiredFields = ['entityId', 'eventType', 'cityId', 'globalUserId'];
  for (const field of requiredFields) {
    if (typeof ctx[field] !== 'string' || !ctx[field]) return false;
  }
  
  return true;
}

/**
 * Builder para contexto de evento
 */
export class EventContextBuilder {
  static forTicket(params: {
    eventId: string;
    eventType: string;
    cityId: string;
    userId: string;
    ticketId: string;
  }): UnifyCardEventContext {
    return {
      module: 'EVENT',
      entityType: 'event',
      entityId: params.eventId,
      eventType: params.eventType,
      cityId: params.cityId,
      globalUserId: params.userId,
      ticketId: params.ticketId
    };
  }
  
  static forConsumption(params: {
    eventId: string;
    eventType: string;
    cityId: string;
    userId: string;
    consumptionId: string;
  }): UnifyCardEventContext {
    return {
      module: 'CONSUMPTION',
      entityType: 'event',
      entityId: params.eventId,
      eventType: params.eventType,
      cityId: params.cityId,
      globalUserId: params.userId,
      consumptionId: params.consumptionId,
      // 🔴 MVP: Consumo herda split do evento (sem regra própria)
      parentModule: 'EVENT'
    };
  }
}















