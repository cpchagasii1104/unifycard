// src/modules/social/actor-effects.types.ts
// Contrato Técnico de EFFECTS (Efeitos Canônicos das Ações)
// 🔴 BLINDAGEM: Effect ≠ Intent ≠ Capacidade ≠ Permissão
// - Intent: o "por quê" da ação, o significado do evento
// - Effect: consequência sistêmica, mudança observável, nunca decisão humana
// - Service NÃO decide efeito - effect é definido pelo contrato
// - Nada implícito, nada "dentro do service" - tudo explícito

/**
 * Enum de Effects do sistema
 * 🔴 BLINDAGEM: Effect é consequência sistêmica, não decisão humana
 * Nada implícito, nada mágico - tudo explícito em código
 */
export enum ActorEffect {
  // Feed e Conteúdo
  FEED_ITEM_CREATED = 'FEED_ITEM_CREATED', // Item criado no feed
  FEED_ITEM_UPDATED = 'FEED_ITEM_UPDATED', // Item atualizado no feed
  
  // Projetos e Oportunidades
  PROJECT_CREATED = 'PROJECT_CREATED', // Projeto criado
  PROJECT_UPDATED = 'PROJECT_UPDATED', // Projeto atualizado
  JOB_POSTED = 'JOB_POSTED', // Vaga anunciada
  
  // Ações Sociais
  CTA_PUBLISHED = 'CTA_PUBLISHED', // Call-to-Action publicado
  VOTE_REGISTERED = 'VOTE_REGISTERED', // Votação registrada
  COMMENT_ADDED = 'COMMENT_ADDED', // Comentário adicionado
  
  // Economia
  PAYMENT_INITIATED = 'PAYMENT_INITIATED', // Pagamento iniciado
  PAYMENT_COMPLETED = 'PAYMENT_COMPLETED', // Pagamento concluído
  GROUP_FUNDS_UPDATED = 'GROUP_FUNDS_UPDATED', // Fundos de grupo atualizados
  
  // Eventos
  EVENT_ANNOUNCED = 'EVENT_ANNOUNCED', // Evento anunciado
  
  // Serviços
  SERVICE_CREATED = 'SERVICE_CREATED', // Serviço criado
  SERVICE_ACTIVATED = 'SERVICE_ACTIVATED', // Serviço ativado
  SERVICE_UPDATED = 'SERVICE_UPDATED', // Serviço atualizado
  SERVICE_AVAILABILITY_CREATED = 'SERVICE_AVAILABILITY_CREATED', // Disponibilidade criada
  SERVICE_AVAILABILITY_UPDATED = 'SERVICE_AVAILABILITY_UPDATED', // Disponibilidade atualizada
  SERVICE_BOOKING_REQUESTED = 'SERVICE_BOOKING_REQUESTED', // Booking solicitado
  SERVICE_BOOKING_CANCELLED = 'SERVICE_BOOKING_CANCELLED', // Booking cancelado
  SERVICE_BOOKING_ACCEPTED = 'SERVICE_BOOKING_ACCEPTED', // Booking aceito (decisão humana)
  SERVICE_BOOKING_REJECTED = 'SERVICE_BOOKING_REJECTED', // Booking rejeitado (decisão humana)
  SERVICE_PAYMENT_REQUESTED = 'SERVICE_PAYMENT_REQUESTED', // Payment request solicitado
  SERVICE_PAYMENT_CANCELLED = 'SERVICE_PAYMENT_CANCELLED', // Payment request cancelado
  SERVICE_PAYMENT_EXECUTED = 'SERVICE_PAYMENT_EXECUTED', // Payment executado
  SERVICE_PAYMENT_SPLIT_APPLIED = 'SERVICE_PAYMENT_SPLIT_APPLIED', // Split aplicado
  
  // Dispatch de Oportunidades
  OPPORTUNITY_DISPATCHED = 'OPPORTUNITY_DISPATCHED', // Oportunidade despachada
  OPPORTUNITY_DISPATCH_RESPONDED = 'OPPORTUNITY_DISPATCH_RESPONDED', // Resposta ao dispatch
  
  // Reputação e Impacto
  IMPACT_RECORDED = 'IMPACT_RECORDED', // Impacto registrado
  REPUTATION_UPDATED = 'REPUTATION_UPDATED', // Reputação atualizada
  
  // Notificações
  NOTIFICATION_SENT = 'NOTIFICATION_SENT', // Notificação enviada
  
  // Disponibilidade e Conflitos
  AVAILABILITY_CONFLICT_DETECTED = 'AVAILABILITY_CONFLICT_DETECTED', // Conflito de disponibilidade detectado (alerta, não bloqueio)
}

/**
 * Payload de um Effect
 */
export interface ActorEffectPayload {
  actorId: string;
  actorType: 'user' | 'page' | 'group' | 'channel';
  intent: string; // Intent que originou o effect
  sourceId?: string; // ID da entidade criada (post_id, project_id, etc)
  sourceType?: string; // Tipo da entidade (post, project, cta, etc)
  metadata?: Record<string, any>; // Metadados adicionais
}

/**
 * Resultado de emissão de Effect
 */
export interface EffectEmissionResult {
  success: boolean;
  effectsEmitted: ActorEffect[];
  errors?: Array<{ effect: ActorEffect; error: string }>;
}

