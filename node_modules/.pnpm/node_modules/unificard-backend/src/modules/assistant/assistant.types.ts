// src/modules/assistant/assistant.types.ts

export type AssistantChannel = 'chat' | 'social' | 'voice';

export type AssistantTargetType = 'user' | 'company' | 'global';

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
  channel: AssistantChannel;
  targetType: AssistantTargetType;
  targetGlobalUserId?: string | null;
  targetCompanyId?: string | null;
  messages: AssistantMessage[];
  suggestedActions: AssistantSuggestedAction[];
  memoryContext?: {
    preferences?: any;
    frequentEntities?: any[];
    suggestedShortcuts?: any[];
  };
}

export interface SendAssistantMessageInput {
  text: string;
  channel?: AssistantChannel;
  targetType?: AssistantTargetType;
  targetGlobalUserId?: string;
  targetCompanyId?: string;
  sessionId?: string;
}

export interface AssistantResponse {
  conversation: AssistantConversation;
  lastMessage: AssistantMessage;
  executedActions?: AssistantSuggestedAction[];
}

export interface UserContext {
  tenantId: string;
  globalUserId: string;
}

