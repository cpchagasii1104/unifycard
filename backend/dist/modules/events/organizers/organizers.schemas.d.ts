import { z } from 'zod';
export declare const createOrganizerSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    logoUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description?: string | null | undefined;
    logoUrl?: string | null | undefined;
}, {
    name: string;
    description?: string | null | undefined;
    logoUrl?: string | null | undefined;
}>;
export declare const addMemberSchema: z.ZodObject<{
    globalUserId: z.ZodString;
    role: z.ZodEnum<["owner", "admin", "editor", "viewer"]>;
}, "strip", z.ZodTypeAny, {
    globalUserId: string;
    role: "admin" | "owner" | "editor" | "viewer";
}, {
    globalUserId: string;
    role: "admin" | "owner" | "editor" | "viewer";
}>;
export declare const linkEventSchema: z.ZodObject<{
    organizerId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    organizerId: string;
}, {
    organizerId: string;
}>;
//# sourceMappingURL=organizers.schemas.d.ts.map