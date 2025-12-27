import { z } from 'zod';
export declare const roleIdSchema: z.ZodObject<{
    roleId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    roleId: string;
}, {
    roleId: string;
}>;
export declare const userIdSchema: z.ZodObject<{
    userId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    userId: string;
}, {
    userId: string;
}>;
export declare const roleUserParamsSchema: z.ZodObject<{
    roleId: z.ZodString;
    userId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    userId: string;
    roleId: string;
}, {
    userId: string;
    roleId: string;
}>;
export declare const createRoleSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description?: string | undefined;
}, {
    name: string;
    description?: string | undefined;
}>;
export declare const updateRoleSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | undefined;
}, {
    name?: string | undefined;
    description?: string | undefined;
}>;
export declare const assignRoleByNameSchema: z.ZodObject<{
    roleName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    roleName: string;
}, {
    roleName: string;
}>;
export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
//# sourceMappingURL=role.schemas.d.ts.map