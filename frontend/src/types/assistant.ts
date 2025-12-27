// src/types/assistant.ts

export type AssistantMessageAuthor = 'user' | 'system';

export interface AssistantMessage {
  messageId: string;
  author: AssistantMessageAuthor;
  content: string;
  createdAt: string;
  intent?: string | null;
  parameters?: Record<string, any> | null;
}

export interface AssistantSuggestedAction {
  actionId: string;
  label: string;
  intent: string;
  parameters: Record<string, any>;
  status: 'available' | 'executed' | 'failed' | 'pending';
}

export interface AssistantConversation {
  sessionId: string;
  channel: 'chat' | 'social' | 'voice';
  targetType: 'user' | 'company' | 'global';
  targetGlobalUserId?: string | null;
  targetCompanyId?: string | null;
  messages: AssistantMessage[];
  suggestedActions: AssistantSuggestedAction[];
  memoryContext?: {
    preferences?: any;
    frequentEntities?: any[];
    suggestedShortcuts?: Array<{
      shortcutId: string;
      label: string;
      intent: string;
      parameters: Record<string, any>;
    }>;
  };
}

export interface AssistantResponse {
  conversation: AssistantConversation;
  lastMessage: AssistantMessage;
  executedActions?: AssistantSuggestedAction[];
}

export interface SendMessageInput {
  text: string;
  channel?: 'chat' | 'social' | 'voice';
  targetType?: 'user' | 'company' | 'global';
  targetGlobalUserId?: string;
  targetCompanyId?: string;
  sessionId?: string;
}

export interface ExecuteActionInput {
  actionId: string;
}

export interface ExecuteActionResponse {
  success: boolean;
  actionId: string;
  intent: string;
  result?: any;
  error?: string;
  executedAt?: string;
}

