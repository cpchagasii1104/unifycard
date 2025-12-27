import { z } from 'zod';
import type { CategoryContext } from '@unificard/contracts';
export declare const CATEGORY_CONTEXT_VALUES: CategoryContext[];
export declare const createCategorySchema: z.ZodObject<{
    name: z.ZodString;
    slug: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    parentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    slug?: string | undefined;
    description?: string | null | undefined;
    parentId?: string | null | undefined;
}, {
    name: string;
    slug?: string | undefined;
    description?: string | null | undefined;
    parentId?: string | null | undefined;
}>;
export declare const createManyCategoriesSchema: z.ZodObject<{
    categories: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        slug: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        parentSlug: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        slug?: string | undefined;
        description?: string | null | undefined;
        parentSlug?: string | null | undefined;
    }, {
        name: string;
        slug?: string | undefined;
        description?: string | null | undefined;
        parentSlug?: string | null | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    categories: {
        name: string;
        slug?: string | undefined;
        description?: string | null | undefined;
        parentSlug?: string | null | undefined;
    }[];
}, {
    categories: {
        name: string;
        slug?: string | undefined;
        description?: string | null | undefined;
        parentSlug?: string | null | undefined;
    }[];
}>;
export declare const assignCategoryToCompanySchema: z.ZodObject<{
    companyId: z.ZodString;
    categoryId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    categoryId: string;
    companyId: string;
}, {
    categoryId: string;
    companyId: string;
}>;
export declare const assignSkillToUserSchema: z.ZodObject<{
    categoryId: z.ZodString;
    skillLevel: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    categoryId: string;
    skillLevel?: number | undefined;
}, {
    categoryId: string;
    skillLevel?: number | undefined;
}>;
export declare const classifyTextSchema: z.ZodObject<{
    text: z.ZodString;
    maxCategories: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    text: string;
    maxCategories?: number | undefined;
}, {
    text: string;
    maxCategories?: number | undefined;
}>;
export declare const aiCreateCategorySchema: z.ZodObject<{
    text: z.ZodString;
    context: z.ZodDefault<z.ZodOptional<z.ZodEnum<[CategoryContext, ...CategoryContext[]]>>>;
    parentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    countryCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    inputType: z.ZodDefault<z.ZodOptional<z.ZodEnum<["text", "voice", "transcription"]>>>;
    audioUrl: z.ZodOptional<z.ZodString>;
    audioHash: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    text: string;
    context: CategoryContext;
    inputType: "text" | "voice" | "transcription";
    parentId?: string | null | undefined;
    countryCode?: string | null | undefined;
    audioUrl?: string | undefined;
    audioHash?: string | undefined;
}, {
    text: string;
    context?: CategoryContext | undefined;
    parentId?: string | null | undefined;
    countryCode?: string | null | undefined;
    inputType?: "text" | "voice" | "transcription" | undefined;
    audioUrl?: string | undefined;
    audioHash?: string | undefined;
}>;
//# sourceMappingURL=categories.schemas.d.ts.map