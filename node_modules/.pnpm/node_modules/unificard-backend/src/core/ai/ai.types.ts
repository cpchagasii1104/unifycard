// backend/src/core/ai/ai.types.ts
import type { ChatMessage } from './memory/memory.types';

export interface ChatRequest {
  message: string;
  tab: string;
}

export interface ChatResponse {
  response: string;
  history?: ChatMessage[];
}

