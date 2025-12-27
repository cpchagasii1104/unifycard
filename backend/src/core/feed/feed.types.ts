// src/core/feed/feed.types.ts
// Tipos para Feed Contextual

export type FeedContentType = 
  | 'pleasure'      // Conteúdo de prazer (Físico)
  | 'learning'      // Conteúdo de aprendizado
  | 'transition'    // Conteúdo de transição (histórias, trajetórias)
  | 'human';        // Conteúdo humano (pessoas, afinidade)

export interface FeedContent {
  id: string;
  type: FeedContentType;
  title: string;
  description?: string;
  author?: {
    id: string;
    name: string;
    avatar?: string;
  };
  metadata?: {
    categoryId?: string;
    categoryName?: string;
    tags?: string[];
    estimatedReadTime?: number;
  };
  createdAt: string;
  priority: number; // 1-10, maior = mais relevante
}

export interface FeedSection {
  id: string;
  title: string; // Título humano: "Talvez você curta", "Você pode gostar de explorar"
  subtitle?: string;
  contentType: FeedContentType;
  contents: FeedContent[];
  priority: number;
}

export interface FeedContextual {
  userState: string; // Estado inferido do usuário
  contextHeader?: string; // Ex: "Hoje seu perfil está mais voltado para criar e explorar"
  sections: FeedSection[];
  hasMore: boolean;
}













