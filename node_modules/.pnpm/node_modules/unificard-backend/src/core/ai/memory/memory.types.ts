// backend/src/core/ai/memory/memory.types.ts
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatHistory {
  userId: string;
  tenantId: string;
  mode: string;
  messages: ChatMessage[];
}


