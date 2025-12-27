import type { FastifyInstance } from 'fastify';
import type { GroupSocialInfo, GroupFeedResult, GroupInsights, ImpactFeedResult } from './social-group.types';
import type { CreatePostInput } from './social.types';
declare class SocialGroupService {
    /**
     * Busca informações sociais de um grupo
     */
    getGroupSocialInfo(tenantId: string, groupId: string): Promise<GroupSocialInfo | null>;
    /**
     * Busca feed de posts de um grupo
     */
    getGroupFeed(tenantId: string, groupId: string, options?: {
        limit?: number;
        offset?: number;
        includeAutoPosts?: boolean;
    }): Promise<GroupFeedResult>;
    /**
     * Cria post dentro de um grupo
     */
    createGroupPost(fastify: FastifyInstance, tenantId: string, groupId: string, globalUserId: string, input: CreatePostInput): Promise<import("./social.types").Post>;
    /**
     * Lista grupos do usuário com informações sociais
     */
    getMyGroups(tenantId: string, userId: string): Promise<GroupSocialInfo[]>;
    /**
     * Busca feed de impacto combinado
     */
    getImpactFeed(tenantId: string, userId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<ImpactFeedResult>;
    /**
     * Busca insights de um grupo
     */
    getGroupInsights(tenantId: string, groupId: string): Promise<GroupInsights | null>;
}
export declare const socialGroupService: SocialGroupService;
export {};
//# sourceMappingURL=social-group.service.d.ts.map