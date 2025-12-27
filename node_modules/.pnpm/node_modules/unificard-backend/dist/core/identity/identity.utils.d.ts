/**
 * Resolve global_user_id a partir de user_id local
 * Tenta primeiro users.global_user_id, depois user_identity_links
 */
export declare function resolveGlobalUserId(userId: string, tenantId?: string): Promise<string | null>;
//# sourceMappingURL=identity.utils.d.ts.map