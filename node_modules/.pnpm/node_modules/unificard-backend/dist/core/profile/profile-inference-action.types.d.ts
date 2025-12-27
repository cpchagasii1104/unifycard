export interface SuggestionAction {
    suggestionId: string;
    action: 'accept' | 'dismiss';
}
export interface SuggestionHistory {
    suggestionId: string;
    action: 'accept' | 'dismiss';
    timestamp: string;
    userId: string;
    tenantId: string;
}
//# sourceMappingURL=profile-inference-action.types.d.ts.map