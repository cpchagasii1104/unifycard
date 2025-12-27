// src/core/profile/profile-inference.types.ts
// Tipos para motor de inferência entre trilhas

export type UserState = 
  | 'explorer'           // Físico preenchido, sem Aprendizado/Profissional
  | 'curious'            // Físico + Aprendizado, sem Profissional
  | 'in_transition'      // Aprendizado ativo, sem Profissional (ou Físico reduzido)
  | 'professional_training' // Aprendizado + Profissional
  | 'professional_stable'   // Apenas Profissional
  | 'at_risk'            // Profissional intenso, sem Físico

export interface CategoryAffinity {
  // Mapeamento de afinidade entre categorias de diferentes contextos
  physicalCategory: string;      // slug ou categoryId do Físico
  learningCategories: string[];  // slugs/categoryIds relacionados no Aprendizado
  professionalCategories: string[]; // slugs/categoryIds relacionados no Profissional
}

export interface InferenceRule {
  id: string;
  name: string;
  description: string;
  condition: (profile: UserProfileSnapshot) => boolean;
  suggestion: (profile: UserProfileSnapshot) => InferenceSuggestion | null;
  priority: number; // 1-10, maior = mais importante
}

export interface UserProfileSnapshot {
  physical: {
    interests: Array<{ categoryId: string; categoryName: string; categoryPath: string[] }>;
    count: number;
  };
  learning: {
    learnings: Array<{ 
      categoryId: string; 
      categoryName: string; 
      categoryPath: string[];
      progress?: 'beginner' | 'intermediate' | 'advanced' | null;
    }>;
    count: number;
    hasIntermediateOrAdvanced: boolean;
  };
  professional: {
    skills: Array<{ categoryId: string; categoryName: string; categoryPath: string[] }>;
    count: number;
  };
  lastUpdated: {
    physical?: string;
    learning?: string;
    professional?: string;
  };
}

export interface InferenceSuggestion {
  id: string;
  type: 'physical_to_learning' | 'learning_to_professional' | 'professional_needs_physical' | 'learning_stagnant';
  title: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string;
  categoryId?: string; // Categoria sugerida
  categoryName?: string;
  categoryPath?: string[];
  priority: number;
  dismissible: boolean;
  shownCount?: number; // Quantas vezes já foi mostrada
  lastShown?: string;
}

export interface InferenceResult {
  userState: UserState;
  suggestions: InferenceSuggestion[];
  insights: {
    hasPhysicalWithoutLearning: boolean;
    hasLearningWithoutProfessional: boolean;
    hasProfessionalWithoutPhysical: boolean;
    learningStagnant: boolean;
  };
}













