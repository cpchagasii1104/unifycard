// src/core/categories/categories.schemas.ts
import { z } from 'zod';
import type { CategoryContext } from '@unificard/contracts';

// Array de valores para validação Zod (baseado no tipo CategoryContext)
// Exportado para uso em rotas e outros lugares que precisam validar o enum
export const CATEGORY_CONTEXT_VALUES: CategoryContext[] = [
  'professional',
  'interest',
  'education',
  'hobby',
  'learning',
  'company',
  'lifestyle',
];

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200, 'Nome deve ter no máximo 200 caracteres'),
  slug: z.string().min(1, 'Slug é obrigatório').max(200, 'Slug deve ter no máximo 200 caracteres').regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens').optional(),
  description: z.string().max(5000, 'Descrição deve ter no máximo 5000 caracteres').nullable().optional(),
  parentId: z.string().uuid('ID da categoria pai inválido').nullable().optional(),
});

export const createManyCategoriesSchema = z.object({
  categories: z.array(z.object({
    name: z.string().min(1, 'Nome é obrigatório').max(200, 'Nome deve ter no máximo 200 caracteres'),
    slug: z.string().min(1, 'Slug é obrigatório').max(200, 'Slug deve ter no máximo 200 caracteres').regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens').optional(),
    description: z.string().max(5000, 'Descrição deve ter no máximo 5000 caracteres').nullable().optional(),
    parentSlug: z.string().nullable().optional(),
  })).min(1, 'Deve ter pelo menos uma categoria'),
});

export const assignCategoryToCompanySchema = z.object({
  companyId: z.string().uuid('ID da empresa inválido'),
  categoryId: z.string().uuid('ID da categoria inválido'),
});

export const assignSkillToUserSchema = z.object({
  categoryId: z.string().uuid('ID da categoria inválido'),
  skillLevel: z.number().int('Nível de skill deve ser um inteiro').min(0, 'Nível mínimo é 0').max(100, 'Nível máximo é 100').optional(),
});

export const classifyTextSchema = z.object({
  text: z.string().min(1, 'Texto é obrigatório').max(10000, 'Texto deve ter no máximo 10000 caracteres'),
  maxCategories: z.number().int('Número máximo de categorias deve ser um inteiro').min(1, 'Mínimo 1 categoria').max(10, 'Máximo 10 categorias').optional(),
});

export const aiCreateCategorySchema = z.object({
  text: z.string().min(1, 'Texto é obrigatório').max(500, 'Texto deve ter no máximo 500 caracteres'),
  context: z.enum(CATEGORY_CONTEXT_VALUES as [CategoryContext, ...CategoryContext[]]).optional().default('professional'),
  parentId: z.string().uuid('ID da categoria pai inválido').nullable().optional(),
  countryCode: z.string().length(2, 'Código do país deve ter 2 caracteres (ISO 3166-1 alpha-2)').nullable().optional(),
  inputType: z.enum(['text', 'voice', 'transcription']).optional().default('text'),
  audioUrl: z.string().url('URL do áudio inválida').optional(),
  audioHash: z.string().length(64, 'Hash do áudio deve ter 64 caracteres (SHA-256)').optional(),
});







