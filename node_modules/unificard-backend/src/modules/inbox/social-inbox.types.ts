// src/modules/inbox/social-inbox.types.ts
// Tipos do Domínio de INBOX SOCIAL DE AÇÕES
// 🔴 BLINDAGEM: Inbox é READ MODEL (derivado de effects)
// 🔴 BLINDAGEM: Inbox NÃO decide nada
// 🔴 BLINDAGEM: Inbox NÃO cria ação automática
// 🔴 BLINDAGEM: Inbox apenas ORGANIZA o que já aconteceu

/**
 * Tipo de Fonte do Inbox
 * 🔴 BLINDAGEM: Fontes são explícitas e derivadas de effects
 */
export enum InboxSourceType {
  DISPATCH = 'dispatch',  // Oportunidade despachada
  BOOKING = 'booking',    // Booking solicitado
  DECISION = 'decision',  // Decisão de booking
  PAYMENT = 'payment',    // Pagamento solicitado/executado
  AVAILABILITY_CONFLICT = 'availability_conflict', // Conflito de disponibilidade detectado (alerta, não bloqueio)
}

/**
 * Status do Item do Inbox
 * 🔴 BLINDAGEM: Status é apenas organização, não decisão
 */
export enum InboxItemStatus {
  UNREAD = 'unread',   // Item não lido
  READ = 'read',       // Item lido
  ARCHIVED = 'archived', // Item arquivado
}

/**
 * Item do Inbox Social (entidade de domínio)
 * 🔴 BLINDAGEM: Inbox é READ MODEL (derivado de effects)
 * 🔴 BLINDAGEM: Inbox NÃO decide nada
 * 🔴 BLINDAGEM: Inbox NÃO cria ação automática
 * 🔴 BLINDAGEM: Inbox apenas ORGANIZA o que já aconteceu
 */
export interface SocialInboxItem {
  inboxItemId: string;
  tenantId: string;
  actorId: string; // OBRIGATÓRIO: Actor destinatário
  sourceType: InboxSourceType; // OBRIGATÓRIO: Tipo da fonte
  sourceId: string; // OBRIGATÓRIO: ID da entidade fonte
  status: InboxItemStatus;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  readAt?: Date | null; // Quando foi lido (se status = 'read')
  archivedAt?: Date | null; // Quando foi arquivado (se status = 'archived')
}

/**
 * Linha do banco de dados (SocialInboxItemRow)
 */
export interface SocialInboxItemRow {
  inbox_item_id: string;
  tenant_id: string;
  actor_id: string;
  source_type: InboxSourceType;
  source_id: string;
  status: InboxItemStatus;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  read_at: Date | null;
  archived_at: Date | null;
}

/**
 * Contador de Inbox (para read model)
 * 🔴 BLINDAGEM: Apenas organização, não decisão
 */
export interface InboxCounter {
  actorId: string;
  tenantId: string;
  unreadCount: number;
  readCount: number;
  archivedCount: number;
  totalCount: number;
  lastUpdated: Date;
}

/**
 * Filtros para busca de items do inbox
 */
export interface SocialInboxFilters {
  actorId: string; // OBRIGATÓRIO
  status?: InboxItemStatus | null; // null = todos
  sourceType?: InboxSourceType;
}

