import type { GroupSocialInfo, GroupFeedOptions, GroupInsights } from './social-group.types';
declare class SocialGroupRepository {
    /**
     * Busca informações sociais de um grupo
     */
    getGroupSocialInfo(tenantId: string, groupId: string): Promise<GroupSocialInfo | null>;
    /**
     * Busca feed de posts de um grupo
     */
    getGroupFeed(tenantId: string, groupId: string, options?: GroupFeedOptions): Promise<{
        rows: any[];
        total: number;
    }>;
    /**
     * Busca insights de um grupo
     */
    getGroupInsights(tenantId: string, groupId: string): Promise<GroupInsights | null>;
    /**
     * Calcula crescimento mensal de recebimentos
     */
    private calculateMonthlyGrowth;
    /**
     * Busca feed de impacto combinado
     */
    getImpactFeed(tenantId: string, userId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<{
        items: any[];
        total: number;
    }>;
}
export declare const socialGroupRepository: SocialGroupRepository;
export {};
//# sourceMappingURL=social-group.repository.d.ts.map