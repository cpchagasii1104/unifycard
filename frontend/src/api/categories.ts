// src/api/categories.ts
// API de categorias profissionais

import { CategoryContext } from '@unificard/contracts';
import { apiFetch } from './client';

export interface Category {
  categoryId: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  level: number;
  path: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CategoryTree extends Category {
  children?: CategoryTree[];
}

export type PricingType = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quote';
export type ServiceType = 'service' | 'product';

export interface PredefinedService {
  serviceId: string;
  name: string;
  description?: string;
  basePrice: number;
  discountPercentage?: number;
  finalPrice: number;
  isActive: boolean;
}

export interface ComboDiscountRule {
  ruleId: string;
  minServices: number; // Mínimo de serviços para aplicar desconto (ex: 2, 3, 4)
  discountPercentage: number; // 0-100
  description?: string;
  isActive: boolean;
}

export interface ProfessionalSkill {
  categoryId: string;
  categoryName: string;
  categoryPath: string[];
  skillLevel: number;
  yearsExperience: number;
  hourlyRate: number | null; // Valor por hora/dia/semana/mês específico para esta profissão (usado se pricingType = 'hourly' | 'daily' | 'weekly' | 'monthly')
  pricingType: PricingType; // 'hourly' = por hora, 'daily' = por dia, 'weekly' = por semana, 'monthly' = por mês, 'quote' = solicitar orçamento primeiro
  serviceType: ServiceType; // 'service' = serviço, 'product' = produto
  chargeVisit: boolean; // Se cobra visita para orçamento
  visitPrice: number | null; // Preço da visita (se chargeVisit = true)
  predefinedServices?: PredefinedService[]; // Serviços pré-definidos com valores fixos
  comboDiscountRules?: ComboDiscountRule[]; // Regras de desconto para combos (múltiplos serviços)
  verified: boolean;
}

export interface AvailabilitySchedule {
  [dayOfWeek: string]: string[]; // "monday", "tuesday", etc. ou "specific": ["2024-12-25:09:00-12:00"]
}

export interface EducationEntry {
  educationId: string;
  level: 'elementary' | 'high_school' | 'technical' | 'bachelor' | 'master' | 'phd' | 'other';
  institution: string;
  course?: string;
  field?: string;
  startDate?: string;
  endDate?: string | null;
  isCompleted: boolean;
  description?: string;
}

export interface ProfessionalProfile {
  globalUserId: string;
  skills: ProfessionalSkill[];
  education: EducationEntry[];
  bio: string | null;
  availability: AvailabilitySchedule | null;
}

export async function getCategoryTree(): Promise<CategoryTree[]> {
  try {
    const response = await apiFetch('/categories/tree');
    const result = await response.json();
    // Suportar formato antigo e novo
    if (result.ok && result.data) {
      return result.data || [];
    }
    if (result.ok === false) {
      throw new Error(result.message || 'Erro ao buscar árvore de categorias');
    }
    return result.tree || [];
  } catch (error) {
    // Melhorar mensagem de erro
    if (error instanceof Error) {
      if (error.message.includes('Erro ao buscar árvore de categorias')) {
        throw error;
      }
      throw new Error(`Erro ao buscar árvore de categorias: ${error.message}`);
    }
    throw new Error('Erro ao buscar árvore de categorias: Erro desconhecido');
  }
}

export async function searchCategories(term: string, limit: number = 50): Promise<Category[]> {
  const response = await apiFetch(`/categories/search?term=${encodeURIComponent(term)}&limit=${limit}`);
  const data = await response.json();
  return data.categories || [];
}

/**
 * Autocomplete inteligente: busca apenas categorias leaf ACTIVE
 * Retorna resultados formatados com path completo para exibição
 */
export async function autocompleteCategories(
  query: string,
  context: CategoryContext = 'professional',
  countryCode?: string | null,
  limit: number = 20
): Promise<CategoryAutocompleteResult[]> {
  if (!query || query.trim().length < 1) {
    return [];
  }

  const params = new URLSearchParams({
    q: query.trim(),
    context,
    limit: limit.toString(),
  });

  if (countryCode) {
    params.append('countryCode', countryCode);
  }

  // DIAGNÓSTICO: Log antes da chamada
  const requestUrl = `/categories/autocomplete?${params.toString()}`;
  console.log('[autocompleteCategories] CHAMANDO:', requestUrl);
  
  const response = await apiFetch(requestUrl);
  
  // DIAGNÓSTICO: Log status da resposta
  console.log('[autocompleteCategories] STATUS:', response.status);
  
  const result = await response.json();
  
  // DIAGNÓSTICO: Log resultado completo
  console.log('[autocompleteCategories] RESULTADO:', { 
    ok: result.ok, 
    dataLength: result.data?.length || 0,
    code: result.code,
    message: result.message,
    firstResult: result.data?.[0]?.name
  });
  
  if (!result.ok) {
    // Padronizar mensagem de erro baseada no código
    const errorMessage = result.code === 'MISSING_TENANT' 
      ? 'Sessão inválida. Faça login novamente.'
      : result.message || 'Erro ao buscar autocomplete de categorias';
    const error = new Error(errorMessage) as any;
    error.code = result.code;
    throw error;
  }
  
  return result.data || [];
}

export async function getProfessionalProfile(): Promise<ProfessionalProfile> {
  const response = await apiFetch('/profile/professional');
  const result = await response.json();
  // Suportar formato antigo e novo
  if (result.ok && result.data) {
    return result.data;
  }
  return result;
}

export async function updateProfessionalProfile(data: {
  skills?: Array<{
    categoryId: string;
    skillLevel?: number;
    yearsExperience?: number;
    hourlyRate?: number | null;
    pricingType?: PricingType;
    serviceType?: ServiceType;
    chargeVisit?: boolean;
    visitPrice?: number | null;
    predefinedServices?: Array<{
      serviceId?: string;
      name: string;
      description?: string;
      basePrice: number;
      discountPercentage?: number;
      isActive?: boolean;
    }>;
    comboDiscountRules?: Array<{
      ruleId?: string;
      minServices: number;
      discountPercentage: number;
      description?: string;
      isActive?: boolean;
    }>;
  }>;
  education?: Array<{
    educationId?: string;
    level: 'elementary' | 'high_school' | 'technical' | 'bachelor' | 'master' | 'phd' | 'other';
    institution: string;
    course?: string;
    field?: string;
    startDate?: string;
    endDate?: string | null;
    isCompleted: boolean;
    description?: string;
  }>;
  bio?: string | null;
  availability?: AvailabilitySchedule | null;
}): Promise<ProfessionalProfile> {
  const response = await apiFetch('/profile/professional', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return response.json();
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
  confidence: number;
  reasoning: string;
  requiresReview: boolean;
  keywords?: string[];
}

export async function suggestCategoryPath(
  text: string,
  context: CategoryContext = 'professional',
  countryCode?: string | null
): Promise<CategoryPathSuggestion> {
  const response = await apiFetch('/categories/suggest-path', {
    method: 'POST',
    body: JSON.stringify({ text, context, countryCode }),
  });
  const result = await response.json();
  if (!result.ok) {
    throw new Error(result.message || 'Erro ao sugerir caminho de categoria');
  }
  return result.data;
}

export async function createCategoryWithAI(
  text: string,
  context: CategoryContext = 'professional',
  parentId?: string | null
): Promise<AICreateCategoryResult> {
  const response = await apiFetch('/categories/ai-create', {
    method: 'POST',
    body: JSON.stringify({ text, context, parentId }),
  });
  const result = await response.json();
  if (!result.ok) {
    throw new Error(result.message || 'Erro ao criar categoria via IA');
  }
  return result.data;
}

