// src/modules/social/actor-intents.types.ts
// Contrato Técnico de INTENTS (Intenções de Ação)
// 🔴 BLINDAGEM: Intent ≠ Capacidade ≠ Permissão
// - Intent: o "por quê" da ação, o significado do evento, o que o sistema entende semanticamente
// - Capacidade: ação possível no sistema, associada ao tipo de Actor
// - Permissão: validação pontual baseada em estado (reputação, verificação, etc)
// - UI NÃO decide intent - intent é semântica explícita
// - Payload NÃO define semântica - intent define semântica

/**
 * Enum de Intents do sistema
 * 🔴 BLINDAGEM: Intent é o "por quê" da ação, não a ação em si
 * Nada implícito, nada mágico - tudo explícito em código
 */
export enum ActorIntent {
  // Conteúdo Social
  SHARE_CONTENT = 'SHARE_CONTENT', // Compartilhar conteúdo (personal, friends)
  ANNOUNCE_EVENT = 'ANNOUNCE_EVENT', // Anunciar evento
  
  // Ofertas e Serviços
  OFFER_SERVICE = 'OFFER_SERVICE', // Ofertar serviço (service_offer)
  OFFER_PRODUCT = 'OFFER_PRODUCT', // Ofertar produto (product_offer)
  REQUEST_BOOKING = 'REQUEST_BOOKING', // Solicitar agendamento (booking)
  
  // Projetos e Oportunidades
  CREATE_PROJECT = 'CREATE_PROJECT', // Criar projeto (project)
  ANNOUNCE_JOB = 'ANNOUNCE_JOB', // Anunciar vaga (futuro)
  
  // Ações Sociais
  START_VOTE = 'START_VOTE', // Iniciar votação (vote)
  REQUEST_HELP = 'REQUEST_HELP', // Solicitar ajuda (futuro)
  
  // Economia
  SEND_CTA = 'SEND_CTA', // Enviar Call-to-Action
  RECEIVE_PAYMENT = 'RECEIVE_PAYMENT', // Receber pagamento (futuro)
}

/**
 * Mapeamento de Intent legado (string) para ActorIntent (enum)
 * 🔴 BLINDAGEM: Mantido para compatibilidade com código existente
 * Migração gradual: código existente usa strings, novo código usa enum
 */
export const LEGACY_INTENT_MAP: Record<string, ActorIntent> = {
  'personal': ActorIntent.SHARE_CONTENT,
  'friends': ActorIntent.SHARE_CONTENT,
  'event': ActorIntent.ANNOUNCE_EVENT,
  'service_offer': ActorIntent.OFFER_SERVICE,
  'product_offer': ActorIntent.OFFER_PRODUCT,
  'booking': ActorIntent.REQUEST_BOOKING,
  'project': ActorIntent.CREATE_PROJECT,
  'vote': ActorIntent.START_VOTE,
};

/**
 * Mapeamento reverso: ActorIntent → string legado
 */
export const INTENT_TO_LEGACY_MAP: Record<ActorIntent, string> = {
  [ActorIntent.SHARE_CONTENT]: 'personal',
  [ActorIntent.ANNOUNCE_EVENT]: 'event',
  [ActorIntent.OFFER_SERVICE]: 'service_offer',
  [ActorIntent.OFFER_PRODUCT]: 'product_offer',
  [ActorIntent.REQUEST_BOOKING]: 'booking',
  [ActorIntent.CREATE_PROJECT]: 'project',
  [ActorIntent.START_VOTE]: 'vote',
  [ActorIntent.ANNOUNCE_JOB]: 'service_offer', // Fallback temporário
  [ActorIntent.REQUEST_HELP]: 'personal', // Fallback temporário
  [ActorIntent.SEND_CTA]: 'service_offer', // Fallback temporário
  [ActorIntent.RECEIVE_PAYMENT]: 'service_offer', // Fallback temporário
};

/**
 * Resultado de validação de Intent
 */
export interface IntentValidationResult {
  valid: boolean;
  reason?: string; // Motivo se inválido
  requiredCapability?: string; // Capacidade exigida se inválido
}

