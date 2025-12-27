export interface Profile {
    profileId: string;
    tenantId: string;
    userId: string;
    fullName: string | null;
    phone: string | null;
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
export interface ProfileRow {
    profile_id: string;
    tenant_id: string;
    user_id: string;
    full_name: string | null;
    phone: string | null;
    metadata: any;
    created_at: Date;
    updated_at: Date;
}
export interface UpdateProfileInput {
    fullName?: string;
    phone?: string;
    metadata?: Record<string, any>;
}
//# sourceMappingURL=profile.types.d.ts.map