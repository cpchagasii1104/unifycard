export interface UserMemoryPreference {
    preferenceId: string;
    tenantId: string;
    globalUserId: string;
    category: string;
    key: string;
    value: any;
    confidence: number;
    usageCount: number;
    lastUsedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface UserMemoryPreferenceRow {
    preference_id: string;
    tenant_id: string;
    global_user_id: string;
    category: string;
    key: string;
    value: any;
    confidence: number;
    usage_count: number;
    last_used_at: Date;
    created_at: Date;
    updated_at: Date;
}
export interface UserMemoryInteraction {
    interactionId: string;
    tenantId: string;
    globalUserId: string;
    intent: string;
    entityType: string;
    entityId: string | null;
    entityName: string | null;
    parameters: Record<string, any>;
    interactionCount: number;
    firstInteractionAt: Date;
    lastInteractionAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface UserMemoryInteractionRow {
    interaction_id: string;
    tenant_id: string;
    global_user_id: string;
    intent: string;
    entity_type: string;
    entity_id: string | null;
    entity_name: string | null;
    parameters: any;
    interaction_count: number;
    first_interaction_at: Date;
    last_interaction_at: Date;
    created_at: Date;
    updated_at: Date;
}
export interface UserMemoryEntity {
    entityId: string;
    tenantId: string;
    globalUserId: string;
    entityType: string;
    targetGlobalUserId: string | null;
    targetCompanyId: string | null;
    entityName: string;
    entityMetadata: Record<string, any>;
    relevanceScore: number;
    interactionCount: number;
    lastInteractionAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface UserMemoryEntityRow {
    entity_id: string;
    tenant_id: string;
    global_user_id: string;
    entity_type: string;
    target_global_user_id: string | null;
    target_company_id: string | null;
    entity_name: string;
    entity_metadata: any;
    relevance_score: number;
    interaction_count: number;
    last_interaction_at: Date;
    created_at: Date;
    updated_at: Date;
}
export interface UserMemoryShortcut {
    shortcutId: string;
    tenantId: string;
    globalUserId: string;
    label: string;
    intent: string;
    parameters: Record<string, any>;
    usageCount: number;
    lastUsedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface UserMemoryShortcutRow {
    shortcut_id: string;
    tenant_id: string;
    global_user_id: string;
    label: string;
    intent: string;
    parameters: any;
    usage_count: number;
    last_used_at: Date;
    created_at: Date;
    updated_at: Date;
}
export interface UserPreferences {
    [category: string]: {
        [key: string]: {
            value: any;
            confidence: number;
            usageCount: number;
            lastUsedAt: Date;
        };
    };
}
export interface UserContext {
    preferences: UserPreferences;
    frequentEntities: UserMemoryEntity[];
    suggestedShortcuts: UserMemoryShortcut[];
    recentInteractions: UserMemoryInteraction[];
}
export interface UpdateFromIntentInput {
    intent: string;
    parameters: Record<string, any>;
    entityType?: string;
    entityId?: string;
    entityName?: string;
}
export interface RegisterInteractionInput {
    entityId: string;
    entityType: string;
    entityName?: string;
    metadata?: Record<string, any>;
}
//# sourceMappingURL=memory.types.d.ts.map