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
  scope?: string; // Scope da categoria (ex: 'professional', 'global')
  /** Identidade semântica/CONCEPT (`categories.concept_id`). Exposto só no contexto profissional. NÃO é navegação; proibido usar como `concept_ref` transacional. */
  conceptId?: string | null;
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

/**
 * SSOT: Método canônico para leitura de categorias
 * Context é OBRIGATÓRIO - não há fallback ou default
 * CountryCode nunca é enviado - vem do tenant no backend
 */
export async function getCategoryTree(context: CategoryContext): Promise<CategoryTree[]> {
  // GUARD: Context obrigatório em tempo de execução (TypeScript já garante em compilação)
  if (!context) {
    throw new Error('SSOT_VIOLATION: context is mandatory for category reads');
  }

  try {
    // SSOT: Sempre enviar context, nunca countryCode
    const params = new URLSearchParams({
      context,
    });
    const url = `/categories/tree?${params.toString()}`;
    
    // 🔴 ADR: Endpoint canônico GET /categories/tree?context=professional
    // tenantId já validado no client.ts antes desta chamada
    const response = await apiFetch(url, {}, { silent404: true });
    const result = await response.json();

    // Suportar formato antigo e novo
    if (result.ok && result.data) {
      return result.data || [];
    }
    if (result.ok === false) {
      throw new Error(result.message || 'Erro ao buscar árvore de categorias');
    }
    return result.tree || [];
  } catch (error: any) {
    // 🔴 FEATURE_UNAVAILABLE não é erro - retornar lista vazia
    if (error.code === 'FEATURE_UNAVAILABLE' || error.status === 404) {
      return []; // Feature não disponível: retornar lista vazia (não é erro)
    }
    
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

export async function searchCategories(term: string, limit: number = 50, context: CategoryContext = 'professional'): Promise<Category[]> {
  const params = new URLSearchParams({
    term: term.trim(),
    limit: limit.toString(),
    context,
  });
  const response = await apiFetch(`/categories/search?${params.toString()}`);
  const data = await response.json();
  return data.categories || [];
}

/**
 * Busca filhos diretos de uma categoria
 * Útil para carregamento sob demanda quando os children não vêm populados na árvore
 *
 * @param context Quando 'professional', o backend surfaça `conceptId` nas folhas (declaração C1).
 *   Sem context explícito, `conceptId` NÃO é exposto (OPÇÃO B, 07 §4262/4278). O fluxo profissional
 *   DEVE passar 'professional' para que a folha traga conceptId real (a trava C1 exige conceptId).
 */
export async function getCategoryChildren(
  categoryId: string,
  context?: CategoryContext
): Promise<Category[]> {
  try {
    const query = context ? `?${new URLSearchParams({ context }).toString()}` : '';
    const response = await apiFetch(`/categories/${categoryId}/children${query}`);
    const result = await response.json();
    if (result.ok && result.data) {
      return result.data.children || [];
    }
    return [];
  } catch (error) {
    console.error('[getCategoryChildren] Erro:', error);
    return [];
  }
}

/**
 * Autocomplete inteligente: busca apenas categorias leaf ACTIVE
 * Retorna resultados formatados com path completo para exibição
 */
export async function autocompleteCategories(
  query: string,
  context: CategoryContext, // OBRIGATÓRIO: sem default
  countryCode?: string | null,
  limit: number = 20
): Promise<CategoryAutocompleteResult[]> {
  // GUARD: Context obrigatório
  if (!context) {
    throw new Error('SSOT_VIOLATION: context is mandatory for category reads');
  }
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
    // Tratar erro 429 (rate limit) silenciosamente - não quebrar UI
    if (response.status === 429 || result.code === 'RATE_LIMIT') {
      // Rate limit: retornar array vazio silenciosamente (não é erro fatal)
      console.warn('[autocompleteCategories] Rate limit atingido, retornando vazio');
      return [];
    }
    
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
  /** Identidade semântica/CONCEPT da folha profissional. Só no autocomplete profissional. */
  conceptId?: string | null;
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
  context: CategoryContext, // OBRIGATÓRIO: sem default
  countryCode?: string | null
): Promise<CategoryPathSuggestion> {
  // GUARD: Context obrigatório
  if (!context) {
    throw new Error('SSOT_VIOLATION: context is mandatory for category reads');
  }
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
  context: CategoryContext, // OBRIGATÓRIO: sem default
  parentId?: string | null
): Promise<AICreateCategoryResult> {
  // GUARD: Context obrigatório
  if (!context) {
    throw new Error('SSOT_VIOLATION: context is mandatory for category reads');
  }
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

