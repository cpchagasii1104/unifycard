// backend/src/modules/live-chat/live-chat.types.ts
// SPRINT 95: LOCAL CHAT (OPT-IN) + PRESENÇA AO VIVO + ANTI-ABUSO

export type LivePresenceStatus = 'ONLINE' | 'OFFLINE';
export type ChatRoomType = 'PUBLIC';
export type ChatRoomStatus = 'ACTIVE' | 'ARCHIVED';
export type ChatMessageStatus = 'VISIBLE' | 'DELETED';
export type ChatReportReason = 'SPAM' | 'HARASSMENT' | 'HATE' | 'SEXUAL' | 'OTHER';
export type ChatReportStatus = 'OPEN' | 'ACK' | 'RESOLVED';
export type PresenceContextType = 'EVENT' | 'VENUE';

export interface LivePresence {
  id: string;
  tenantId: string;
  contextType: PresenceContextType;
  contextId: string;
  contactId: string;
  status: LivePresenceStatus;
  optedIn: boolean;
  lastSeenAt: Date;
  expiresAt: Date;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatRoom {
  id: string;
  tenantId: string;
  contextType: PresenceContextType;
  contextId: string;
  roomType: ChatRoomType;
  status: ChatRoomStatus;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface ChatMessage {
  id: string;
  tenantId: string;
  roomId: string;
  contactId: string;
  content: string;
  status: ChatMessageStatus;
  clientMessageId: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface ChatBlock {
  id: string;
  tenantId: string;
  blockerContactId: string;
  blockedContactId: string;
  contextType: PresenceContextType;
  contextId: string;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface ChatReport {
  id: string;
  tenantId: string;
  reporterContactId: string;
  reportedContactId: string;
  roomId: string;
  messageId: string | null;
  reasonCode: ChatReportReason;
  details: string | null;
  status: ChatReportStatus;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface OptInInput {
  contextType: PresenceContextType;
  contextId: string;
  contactId: string;
}

export interface SendMessageInput {
  roomId: string;
  contactId: string;
  content: string;
  clientMessageId?: string | null;
}

export interface BlockContactInput {
  blockerContactId: string;
  blockedContactId: string;
  contextType: PresenceContextType;
  contextId: string;
}

export interface ReportContactInput {
  reporterContactId: string;
  reportedContactId: string;
  roomId: string;
  messageId?: string | null;
  reasonCode: ChatReportReason;
  details?: string | null;
}

export interface ChatMessageFilters {
  cursor?: string;
  limit?: number;
}





