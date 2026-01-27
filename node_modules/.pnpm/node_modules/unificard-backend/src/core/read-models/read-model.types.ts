// src/core/read-models/read-model.types.ts
// Contrato Técnico de READ MODELS (Projection Layer)
// 🔴 BLINDAGEM: ReadModel ≠ fonte de verdade
// - ReadModel não é verdade
// - ReadModel não é contrato de negócio
// - ReadModel pode ser descartado e reconstruído
// - ReadModel nunca consome intents
// - ReadModel nunca decide regra

/**
 * Enum de Read Models do sistema
 * 🔴 BLINDAGEM: ReadModel é projeção derivada, não fonte de verdade
 * Nada implícito, nada mágico - tudo explícito em código
 */
export enum ReadModelType {
  // Perfis
  PROFILE_READ_MODEL = 'PROFILE_READ_MODEL', // Perfil completo do usuário
  EDUCATION_PROFILE_READ_MODEL = 'EDUCATION_PROFILE_READ_MODEL', // Perfil educacional
  PROFESSIONAL_PROFILE_READ_MODEL = 'PROFESSIONAL_PROFILE_READ_MODEL', // Perfil profissional
  LEARNING_PROFILE_READ_MODEL = 'LEARNING_PROFILE_READ_MODEL', // Perfil de aprendizado
  
  // Feed e Conteúdo
  FEED_READ_MODEL = 'FEED_READ_MODEL', // Feed de posts
  POST_READ_MODEL = 'POST_READ_MODEL', // Post individual
  
  // Oportunidades
  OPPORTUNITY_READ_MODEL = 'OPPORTUNITY_READ_MODEL', // Oportunidades sugeridas
  
  // Reputação
  REPUTATION_READ_MODEL = 'REPUTATION_READ_MODEL', // Reputação do actor
  
  // Grupos
  GROUP_READ_MODEL = 'GROUP_READ_MODEL', // Grupo individual
  GROUP_LIST_READ_MODEL = 'GROUP_LIST_READ_MODEL', // Lista de grupos
  
  // Projetos
  PROJECT_READ_MODEL = 'PROJECT_READ_MODEL', // Projeto individual
  PROJECT_LIST_READ_MODEL = 'PROJECT_LIST_READ_MODEL', // Lista de projetos
  
  // Matching
  MATCHING_READ_MODEL = 'MATCHING_READ_MODEL', // Sugestões de matching
  
  // Serviços
  SERVICE_READ_MODEL = 'SERVICE_READ_MODEL', // Serviço individual
  SERVICE_LIST_READ_MODEL = 'SERVICE_LIST_READ_MODEL', // Lista de serviços
  SERVICE_AVAILABILITY_READ_MODEL = 'SERVICE_AVAILABILITY_READ_MODEL', // Disponibilidade individual
  SERVICE_AVAILABILITY_LIST_READ_MODEL = 'SERVICE_AVAILABILITY_LIST_READ_MODEL', // Lista de disponibilidades
  BOOKING_READ_MODEL = 'BOOKING_READ_MODEL', // Booking individual
  BOOKING_LIST_READ_MODEL = 'BOOKING_LIST_READ_MODEL', // Lista de bookings
  BOOKING_DECISION_READ_MODEL = 'BOOKING_DECISION_READ_MODEL', // Decisão de booking individual
  PAYMENT_READ_MODEL = 'PAYMENT_READ_MODEL', // Payment request individual
  PAYMENT_LIST_READ_MODEL = 'PAYMENT_LIST_READ_MODEL', // Lista de payment requests
  PAYMENT_EXECUTION_READ_MODEL = 'PAYMENT_EXECUTION_READ_MODEL', // Execução de pagamento individual
  PAYMENT_SPLIT_READ_MODEL = 'PAYMENT_SPLIT_READ_MODEL', // Split de pagamento individual
  
  // Dashboard Econômico (READ-ONLY)
  ACTOR_ECONOMIC_OVERVIEW_READ_MODEL = 'ACTOR_ECONOMIC_OVERVIEW_READ_MODEL', // Overview econômico de um actor
  GROUP_ECONOMIC_OVERVIEW_READ_MODEL = 'GROUP_ECONOMIC_OVERVIEW_READ_MODEL', // Overview econômico de um grupo
  
  // Dispatch de Oportunidades
  DISPATCH_INBOX_READ_MODEL = 'DISPATCH_INBOX_READ_MODEL', // Inbox de dispatches pendentes
  DISPATCH_HISTORY_READ_MODEL = 'DISPATCH_HISTORY_READ_MODEL', // Histórico de dispatches
  
  // Inbox Social
  INBOX_READ_MODEL = 'INBOX_READ_MODEL', // Inbox social de ações
  INBOX_COUNTER_READ_MODEL = 'INBOX_COUNTER_READ_MODEL', // Contador de inbox (quantidade de pendentes)
}

/**
 * Interface base para Read Models
 * 🔴 BLINDAGEM: ReadModel é projeção derivada, não fonte de verdade
 */
export interface ReadModel {
  readModelType: ReadModelType;
  entityId: string; // ID da entidade (userId, postId, groupId, etc)
  tenantId: string;
  version: number; // Versão do read model (para cache invalidation)
  lastUpdated: Date; // Última atualização
  data: Record<string, any>; // Dados projetados
}

/**
 * Resultado de projeção de Read Model
 */
export interface ReadModelProjectionResult {
  success: boolean;
  readModelType: ReadModelType;
  entityId: string;
  errors?: Array<{ field: string; error: string }>;
}

