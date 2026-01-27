"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiCreateCategorySchema = exports.classifyTextSchema = exports.assignSkillToUserSchema = exports.assignCategoryToCompanySchema = exports.createManyCategoriesSchema = exports.createCategorySchema = exports.CATEGORY_CONTEXT_VALUES = void 0;
// src/core/categories/categories.schemas.ts
const zod_1 = require("zod");
// ===============================
// Contextos canônicos permitidos
// ===============================
exports.CATEGORY_CONTEXT_VALUES = [
    'professional',
    'interest',
    'education',
    'hobby',
    'learning',
    'health', // Saúde (autodeclaração, NUNCA diagnóstico)
    'company',
    'lifestyle',
];
// ===============================
// Helpers canônicos
// ===============================
const slugSchema = zod_1.z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens');
const uuidSchema = zod_1.z.string().uuid('UUID inválido');
// ===============================
// Criação manual (humano / admin)
// ===============================
exports.createCategorySchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(200),
    slug: slugSchema.optional(),
    description: zod_1.z.string().max(5000).nullable().optional(),
    // Estrutura
    parentId: uuidSchema.nullable().optional(),
}).superRefine((data, ctx) => {
    // Root explícito ou child explícito, nunca ambíguo
    if (data.parentId === undefined) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'parentId deve ser explicitamente null (root) ou UUID (child)',
        });
    }
});
// ===============================
// Criação em lote (seed controlado)
// ===============================
exports.createManyCategoriesSchema = zod_1.z.object({
    categories: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string().min(1).max(200),
        slug: slugSchema.optional(),
        description: zod_1.z.string().max(5000).nullable().optional(),
        // Apenas UMA forma de vínculo
        parentSlug: zod_1.z.string().nullable().optional(),
    })).min(1),
}).superRefine((data, ctx) => {
    const slugs = new Set();
    for (const cat of data.categories) {
        if (cat.slug) {
            if (slugs.has(cat.slug)) {
                ctx.addIssue({
                    code: zod_1.z.ZodIssueCode.custom,
                    message: `Slug duplicado no batch: ${cat.slug}`,
                });
            }
            slugs.add(cat.slug);
        }
    }
});
// ===============================
// Associação empresa ↔ categoria
// ===============================
exports.assignCategoryToCompanySchema = zod_1.z.object({
    companyId: uuidSchema,
    categoryId: uuidSchema,
});
// ===============================
// Skill do usuário
// ===============================
exports.assignSkillToUserSchema = zod_1.z.object({
    categoryId: uuidSchema,
    skillLevel: zod_1.z.number().int().min(0).max(100).optional(),
});
// ===============================
// Classificação de texto (NÃO cria)
// ===============================
exports.classifyTextSchema = zod_1.z.object({
    text: zod_1.z.string().min(1).max(10000),
    maxCategories: zod_1.z.number().int().min(1).max(10).optional(),
});
// ===============================
// IA — proposição, NÃO criação livre
// ===============================
exports.aiCreateCategorySchema = zod_1.z.object({
    text: zod_1.z.string().min(1).max(500),
    context: zod_1.z
        .enum(exports.CATEGORY_CONTEXT_VALUES)
        .default('professional'),
    parentId: uuidSchema.nullable().optional(),
    countryCode: zod_1.z
        .string()
        .length(2, 'Código do país deve ter 2 caracteres (ISO 3166-1 alpha-2)')
        .nullable()
        .optional(),
    inputType: zod_1.z.enum(['text', 'voice', 'transcription']).default('text'),
    audioUrl: zod_1.z.string().url().optional(),
    audioHash: zod_1.z.string().length(64).optional(),
}).superRefine((data, ctx) => {
    // IA nunca cria root implicitamente
    if (data.parentId === undefined) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'IA não pode criar categoria sem parentId explícito',
        });
    }
});
