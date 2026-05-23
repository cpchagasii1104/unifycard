// src/core/categories/categories.types.ts

import { CategoryContext, CategoryStatus } from '@unificard/contracts';

export interface Category {
  categoryId: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  level: number;
  path: string[];
  keywords: string[];
  countryCode: string | null; // Código ISO do país (ex: 'BR', 'US', 'CN'). NULL para categorias globais
  scope?: string; // Scope da categoria (ex: 'professional', 'cause', 'learning')
  /** PRODUCT = taxonomia catálogo físico; SERVICE = legado (papéis/navegação). Coluna `categories.domain_type`. */
  domainType?: 'SERVICE' | 'PRODUCT';
  status?: CategoryStatus;
  requiresReview?: boolean;
  createdByAI?: boolean;
  approvedBy?: string | null;
  approvedAt?: Date | null;
  rejectionReason?: string | null;
  /** JSONB `categories.metadata` (ex.: domain marketplace). */
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryRow {
  category_id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  level: number;
  path: string[];
  keywords: string[] | null;
  country_code: string | null;
  scope?: string;
  domain_type?: 'SERVICE' | 'PRODUCT';
  status?: CategoryStatus;
  requires_review?: boolean;
  created_by_ai?: boolean;
  approved_by?: string | null;
  /** Coluna DB (snake_case); node-pg pode devolver Date */
  approved_at?: Date | string | null;
  rejection_reason?: string | null;
  metadata?: unknown;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface CategoryTree extends Category {
  children?: CategoryTree[];
}

export interface CreateCategoryInput {
  name?: string;
  slug?: string;
  description?: string | null;
  parentId?: string | null;
  /** Alternativa a parentId: resolve pai pelo slug (usado em scripts) */
  parentSlug?: string | null;
  keywords?: string[];
  countryCode?: string | null; // Código ISO do país para categorias específicas por país
  // GOVERNANÇA: Flag explícita para criar como active (requer validação de admin)
  allowActive?: boolean;
  // AUDITORIA: Origem da criação
  createdBy?: {
    userId?: string;
    actorId?: string;
    tenantId?: string;
    source: 'manual' | 'script' | 'ai' | 'migration';
  };
}

export interface CreateManyCategoriesInput {
  categories: Array<{
    name: string;
    slug?: string;
    description?: string | null;
    parentSlug?: string | null;
  }>;
}

export interface AssignCategoryToCompanyInput {
  companyId?: string;
  categoryId?: string;
}

export interface AssignSkillToUserInput {
  categoryId?: string;
  skillLevel?: number;
  yearsExperience?: number;
  hourlyRate?: number | null;
}

export interface ClassifyTextInput {
  text?: string;
  maxCategories?: number;
}

export interface CategoryClassification {
  categoryId: string;
  categoryName: string;
  confidence: number;
  path: string[];
}

export interface AICreateCategoryInput {
  text: string; // Texto ou transcrição de voz
  context?: CategoryContext; // Contexto de uso
  parentId?: string | null; // ID da categoria pai (se conhecido)
  countryCode?: string | null;
  tenantId?: string;
  actorId?: string;
  globalUserId?: string;
  inputType?: 'text' | 'voice' | 'transcription';
  audioUrl?: string;
  audioHash?: string;
}

export interface AICreateCategoryResult {
  created: boolean;
  category?: Category;
  existingCategory?: Category;
  message: string;
  suggestedParent?: {
    categoryId: string;
    name: string;
    path: string[];
  } | null;
  requiresApproval: boolean;
}

/**
 * Resultado da sugestão de caminho hierárquico pela IA
 * IA atua como CLASSIFICADORA, não criadora
 */
export interface CategoryAutocompleteResult {
  id: string;
  name: string;
  slug: string;
  level: number;
  path: string[];
  fullPathLabel: string;
}

export interface CategoryPathSuggestion {
  normalizedInput: string;
  suggestedRoot: {
    id: string;
    name: string;
    slug: string;
    path: string[];
  } | null;
  suggestedParent: {
    id: string;
    name: string;
    slug: string;
    path: string[];
    level: number;
  } | null;
  leafName: string;
  leafDescription: string | null;
  confidence: number; // 0.0 a 1.0
  reasoning: string;
  requiresReview: boolean; // true se confidence < threshold ou sem parent válido
  keywords?: string[];
}








