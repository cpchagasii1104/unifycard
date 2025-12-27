import { z } from 'zod';
export declare const createSkillSchema: z.ZodObject<{
    name: z.ZodString;
    category: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    category: string;
    description?: string | undefined;
}, {
    name: string;
    category: string;
    description?: string | undefined;
}>;
export declare const updateSkillSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | undefined;
    category?: string | undefined;
}, {
    name?: string | undefined;
    description?: string | undefined;
    category?: string | undefined;
}>;
export declare const skillIdParamsSchema: z.ZodObject<{
    skillId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    skillId: string;
}, {
    skillId: string;
}>;
export declare const listSkillsQuerySchema: z.ZodObject<{
    category: z.ZodOptional<z.ZodString>;
    search: z.ZodOptional<z.ZodString>;
    limit: z.ZodEffects<z.ZodOptional<z.ZodString>, number | undefined, string | undefined>;
    offset: z.ZodEffects<z.ZodOptional<z.ZodString>, number | undefined, string | undefined>;
}, "strip", z.ZodTypeAny, {
    search?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
    category?: string | undefined;
}, {
    search?: string | undefined;
    limit?: string | undefined;
    offset?: string | undefined;
    category?: string | undefined;
}>;
//# sourceMappingURL=skill.schemas.d.ts.map