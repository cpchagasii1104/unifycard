// src/core/profile/profile-learning.types.ts
// Tipos para perfil de aprendizado/trilha

export interface LearningCategory {
  categoryId: string;
  categoryName: string;
  categoryPath: string[];
  level: number;
}

export interface LearningProfile {
  globalUserId: string;
  learnings: LearningCategory[]; // Categorias de aprendizado selecionadas
  preferences: {
    // Preferências específicas por categoria
    [categoryId: string]: {
      details?: string[]; // Ex: ["Básico", "Intermediário"] para nível
      notes?: string; // Observações sobre o aprendizado
      progress?: 'beginner' | 'intermediate' | 'advanced' | null; // Nível de progresso
    };
  };
  metadata: Record<string, any>; // Dados adicionais flexíveis
}

export interface UpdateLearningProfileInput {
  learnings?: string[]; // Array de categoryIds
  preferences?: {
    [categoryId: string]: {
      details?: string[];
      notes?: string;
      progress?: 'beginner' | 'intermediate' | 'advanced' | null;
    };
  };
  metadata?: Record<string, any>;
}













