"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiCreateCategorySchema = exports.classifyTextSchema = exports.assignSkillToUserSchema = exports.assignCategoryToCompanySchema = exports.createManyCategoriesSchema = exports.createCategorySchema = exports.CATEGORY_CONTEXT_VALUES = void 0;
// src/core/categories/categories.schemas.ts
const zod_1 = require("zod");
// Array de valores para validação Zod (baseado no tipo CategoryContext)
// Exportado para uso em rotas e outros lugares que precisam validar o enum
exports.CATEGORY_CONTEXT_VALUES = [
    'professional',
    'interest',
    'education',
    'hobby',
    'learning',
    'company',
    'lifestyle',
];
exports.createCategorySchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Nome é obrigatório').max(200, 'Nome deve ter no máximo 200 caracteres'),
    slug: zod_1.z.string().min(1, 'Slug é obrigatório').max(200, 'Slug deve ter no máximo 200 caracteres').regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens').optional(),
    description: zod_1.z.string().max(5000, 'Descrição deve ter no máximo 5000 caracteres').nullable().optional(),
    parentId: zod_1.z.string().uuid('ID da categoria pai inválido').nullable().optional(),
});
exports.createManyCategoriesSchema = zod_1.z.object({
    categories: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string().min(1, 'Nome é obrigatório').max(200, 'Nome deve ter no máximo 200 caracteres'),
        slug: zod_1.z.string().min(1, 'Slug é obrigatório').max(200, 'Slug deve ter no máximo 200 caracteres').regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens').optional(),
        description: zod_1.z.string().max(5000, 'Descrição deve ter no máximo 5000 caracteres').nullable().optional(),
        parentSlug: zod_1.z.string().nullable().optional(),
    })).min(1, 'Deve ter pelo menos uma categoria'),
});
exports.assignCategoryToCompanySchema = zod_1.z.object({
    companyId: zod_1.z.string().uuid('ID da empresa inválido'),
    categoryId: zod_1.z.string().uuid('ID da categoria inválido'),
});
exports.assignSkillToUserSchema = zod_1.z.object({
    categoryId: zod_1.z.string().uuid('ID da categoria inválido'),
    skillLevel: zod_1.z.number().int('Nível de skill deve ser um inteiro').min(0, 'Nível mínimo é 0').max(100, 'Nível máximo é 100').optional(),
});
exports.classifyTextSchema = zod_1.z.object({
    text: zod_1.z.string().min(1, 'Texto é obrigatório').max(10000, 'Texto deve ter no máximo 10000 caracteres'),
    maxCategories: zod_1.z.number().int('Número máximo de categorias deve ser um inteiro').min(1, 'Mínimo 1 categoria').max(10, 'Máximo 10 categorias').optional(),
});
exports.aiCreateCategorySchema = zod_1.z.object({
    text: zod_1.z.string().min(1, 'Texto é obrigatório').max(500, 'Texto deve ter no máximo 500 caracteres'),
    context: zod_1.z.enum(exports.CATEGORY_CONTEXT_VALUES).optional().default('professional'),
    parentId: zod_1.z.string().uuid('ID da categoria pai inválido').nullable().optional(),
    countryCode: zod_1.z.string().length(2, 'Código do país deve ter 2 caracteres (ISO 3166-1 alpha-2)').nullable().optional(),
    inputType: zod_1.z.enum(['text', 'voice', 'transcription']).optional().default('text'),
    audioUrl: zod_1.z.string().url('URL do áudio inválida').optional(),
    audioHash: zod_1.z.string().length(64, 'Hash do áudio deve ter 64 caracteres (SHA-256)').optional(),
});
//# sourceMappingURL=categories.schemas.js.map