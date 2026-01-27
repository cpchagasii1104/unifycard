// src/api/category.ts
// API de Categorias (Category Core)

import { apiFetch } from './client';

export interface Category {
  id: string;
  slug: string;
  name: string;
  description?: string;
  parentId?: string;
  scope: 'global' | 'group' | 'company' | 'event' | 'campaign' | 'professional' | 'interest' | 'learning' | 'cause';
  isActive: boolean;
  icon?: string;
  color?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryWithChildren extends Category {
  children?: Category[];
}

export interface GetCategoriesParams {
  scope?: 'global' | 'group' | 'company' | 'event' | 'campaign' | 'professional' | 'interest' | 'learning' | 'cause';
  parentId?: string;
  includeChildren?: boolean;
}

/**
 * GET /categories/search
 * Lista categorias usando busca canônica
 * BLOCKED_BY_FRONTEND_DEPENDENCY: Mantido para compatibilidade, mas deve migrar para searchCategories com context
 */
export async function getCategories(params?: GetCategoriesParams): Promise<Category[]> {
  // BLOCKED_BY_FRONTEND_DEPENDENCY: Endpoint antigo mantido para compatibilidade
  // Migrar para searchCategories com context apropriado
  const queryParams = new URLSearchParams();
  
  if (params?.scope) {
    queryParams.append('scope', params.scope);
  }
  if (params?.parentId) {
    queryParams.append('parent_id', params.parentId);
  }
  if (params?.includeChildren) {
    queryParams.append('include_children', 'true');
  }

  const queryString = queryParams.toString();
  const url = `/categories${queryString ? `?${queryString}` : ''}`;

  const response = await apiFetch(url, {}, { silent404: true });
  
  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return Array.isArray(data.categories) ? data.categories : [];
}

/**
 * GET /categories/:id
 * Buscar categoria por ID
 */
export async function getCategoryById(categoryId: string): Promise<Category | null> {
  try {
    const response = await apiFetch(`/categories/${categoryId}`, {}, { silent404: true });
    
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.category || null;
  } catch (error) {
    console.warn('[Category API] Erro ao buscar categoria:', error);
    return null;
  }
}

/**
 * GET /categories/slug/:slug
 * Buscar categoria por slug
 */
export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  try {
    const response = await apiFetch(`/categories/slug/${slug}`, {}, { silent404: true });
    
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.category || null;
  } catch (error) {
    console.warn('[Category API] Erro ao buscar categoria por slug:', error);
    return null;
  }
}



