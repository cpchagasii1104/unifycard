// src/modules/social/actor-capabilities.types.ts
// Contrato Técnico de Capacidades por Actor
// 🔴 BLINDAGEM: Capacidade ≠ Permissão
// - Capacidade: ação possível no sistema, associada ao tipo de Actor
// - Permissão: validação pontual baseada em estado (reputação, verificação, etc)
// - UI NÃO decide capacidades - são definidas no backend
// - Isso protege o sistema no longo prazo contra decisões implícitas

/**
 * Enum de capacidades do sistema
 * 🔴 BLINDAGEM: Nada implícito, nada herdado silenciosamente
 * Tudo explícito em código
 */
export enum ActorCapability {
  // Conteúdo Social
  POST_CONTENT = 'POST_CONTENT', // Criar posts no feed
  COMMENT = 'COMMENT', // Comentar em posts
  VOTE = 'VOTE', // Votar em votações
  
  // Projetos e Oportunidades
  CREATE_PROJECT = 'CREATE_PROJECT', // Criar projetos
  CREATE_JOB = 'CREATE_JOB', // Criar vagas de trabalho
  APPLY_JOB = 'APPLY_JOB', // Candidatar-se a vagas
  
  // Economia
  RECEIVE_FUNDS = 'RECEIVE_FUNDS', // Receber pagamentos/doações
  SEND_FUNDS = 'SEND_FUNDS', // Enviar pagamentos/doações
  
  // Gestão
  MANAGE_MEMBERS = 'MANAGE_MEMBERS', // Gerenciar membros (grupos/empresas)
  MANAGE_CONTENT = 'MANAGE_CONTENT', // Gerenciar conteúdo próprio
  
  // Eventos
  CREATE_EVENT = 'CREATE_EVENT', // Criar eventos
  HOST_EVENT = 'HOST_EVENT', // Hospedar eventos de outros
  
  // Outros
  CREATE_CTA = 'CREATE_CTA', // Criar Call-to-Action (botões de ação)
}

/**
 * Tipo de Actor suportado
 */
export type ActorType = 'user' | 'page' | 'group' | 'channel';

/**
 * Resultado de verificação de capacidade
 */
export interface CapabilityCheck {
  hasCapability: boolean;
  reason?: string; // Motivo se não tiver capacidade
}

/**
 * Mapa de capacidades por tipo de Actor
 * 🔴 BLINDAGEM: Tudo explícito - nada implícito ou herdado silenciosamente
 */
export type ActorCapabilitiesMap = Record<ActorType, ActorCapability[]>;

