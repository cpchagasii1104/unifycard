// src/modules/social-chat/social-chat.types.ts

export interface ChatMessage {
  messageId: string;
  conversationId: string;
  tenantId: string;
  globalUserId: string;
  content: string;
  rawContent?: string | null;
  media: MediaItem[];
  intent?: string | null;
  confidence?: number | null;
  categories: string[];
  suggestedActions: SuggestedAction[];
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface ChatMessageRow {
  message_id: string;
  conversation_id: string;
  tenant_id: string;
  global_user_id: string;
  content: string;
  raw_content: string | null;
  media: any; // JSONB
  intent: string | null;
  confidence: number | null;
  categories: string[];
  suggested_actions: any; // JSONB
  metadata: any; // JSONB
  created_at: Date;
}

export interface MediaItem {
  type: 'image' | 'video' | 'audio';
  url: string;
  thumbnailUrl?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface SuggestedAction {
  action: string;
  module: string;
  endpoint?: string;
  payload?: Record<string, any>;
  description: string;
}

export interface SendMessageInput {
  conversationId?: string;
  text?: string;
  audioUrl?: string;
  media?: MediaItem[];
  metadata?: Record<string, any>;
}

export interface MessageAnalysis {
  intent?: string;
  confidence?: number;
  categories: string[];
  suggestedActions: SuggestedAction[];
}

export interface Conversation {
  conversationId: string;
  messages: ChatMessage[];
  total: number;
  actions: Array<{
    actionId: string;
    intent: string;
    status: string;
    createdAt: Date;
  }>;
}








