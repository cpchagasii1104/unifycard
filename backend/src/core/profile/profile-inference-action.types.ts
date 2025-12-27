// src/core/profile/profile-inference-action.types.ts
// Tipos para ações de sugestões

export interface SuggestionAction {
  suggestionId: string;
  action: 'accept' | 'dismiss';
}

export interface SuggestionHistory {
  suggestionId: string;
  action: 'accept' | 'dismiss';
  timestamp: string;
  userId: string;
  tenantId: string;
}













