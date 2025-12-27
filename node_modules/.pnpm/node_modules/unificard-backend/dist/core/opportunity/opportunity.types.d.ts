export type OpportunityType = 'exploratory' | 'community' | 'professional';
export interface Opportunity {
    id: string;
    type: OpportunityType;
    title: string;
    description: string;
    category?: {
        id: string;
        name: string;
    };
    metadata?: {
        isPaid?: boolean;
        isRemote?: boolean;
        estimatedTime?: string;
        tags?: string[];
    };
    priority: number;
    createdAt: string;
}
export interface OpportunityResult {
    opportunities: Opportunity[];
    hasMore: boolean;
}
//# sourceMappingURL=opportunity.types.d.ts.map