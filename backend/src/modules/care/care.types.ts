// src/modules/care/care.types.ts

export interface CareSession {
  careSessionId: string;
  tenantId: string;
  globalUserId: string;
  targetGlobalUserId: string | null;
  targetCompanyId: string | null;
  lastMessage: string | null;
  state: CareSessionState;
  context: CareSessionContext;
  createdAt: string;
  updatedAt: string;
}

export interface CareSessionRow {
  care_session_id: string;
  tenant_id: string;
  global_user_id: string;
  target_global_user_id: string | null;
  target_company_id: string | null;
  last_message: string | null;
  state: any; // JSONB
  context: any; // JSONB
  created_at: Date;
  updated_at: Date;
}

export interface CareMessage {
  messageId: string;
  careSessionId: string;
  isFromUser: boolean;
  content: string;
  intent: string | null;
  parameters: Record<string, any> | null;
  aiReasoning: Record<string, any> | null;
  createdAt: string;
}

export interface CareMessageRow {
  message_id: string;
  care_session_id: string;
  is_from_user: boolean;
  content: string;
  intent: string | null;
  parameters: any; // JSONB
  ai_reasoning: any; // JSONB
  created_at: Date;
}

export interface CareSessionState {
  currentIntent?: string;
  missingParameters: string[];
  askedQuestions: string[];
  pendingActions: string[];
  isReadyToExecute: boolean;
  executionAttempts: number;
}

export interface CareSessionContext {
  detectedIntents: Array<{
    intent: string;
    confidence: number;
    parameters: Record<string, any>;
  }>;
  categories: string[];
  suggestedActions: Array<{
    action: string;
    module: string;
    description: string;
  }>;
  scheduleAvailability?: {
    workerId?: string;
    availableSlots: Array<{
      startTime: Date;
      endTime: Date;
      slotId: string;
    }>;
  };
  conversationHistory: Array<{
    role: 'user' | 'system';
    content: string;
    timestamp: Date;
  }>;
}

export interface SendMessageInput {
  text?: string;
  targetGlobalUserId?: string | null;
  targetCompanyId?: string | null;
  sessionId?: string | null;
}

export interface CareResponse {
  session: CareSession;
  message: CareMessage;
  aiResponse: {
    content: string;
    reasoning: Record<string, any>;
    nextSteps: string[];
    suggestedActions: Array<{
      action: string;
      description: string;
    }>;
  };
  isReadyToExecute: boolean;
  executionResult?: any;
}

export interface CareSessionWithMessages extends CareSession {
  messages: CareMessage[];
  totalMessages: number;
}














