import type { GroupInsights } from './groups.types';
declare class GroupsInsightsService {
    getGroupInsights(tenantId: string, groupId: string): Promise<GroupInsights>;
    private generateAISummary;
}
export declare const groupsInsightsService: GroupsInsightsService;
export {};
//# sourceMappingURL=groups.insights.service.d.ts.map