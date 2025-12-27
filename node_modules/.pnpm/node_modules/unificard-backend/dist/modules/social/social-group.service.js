"use strict";
// src/modules/social/social-group.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.socialGroupService = void 0;
const social_group_repository_1 = require("./social-group.repository");
const social_service_1 = require("./social.service");
const groups_repository_1 = require("../groups/groups.repository");
const groups_service_1 = require("../groups/groups.service");
class SocialGroupService {
    /**
     * Busca informações sociais de um grupo
     */
    async getGroupSocialInfo(tenantId, groupId) {
        return social_group_repository_1.socialGroupRepository.getGroupSocialInfo(tenantId, groupId);
    }
    /**
     * Busca feed de posts de um grupo
     */
    async getGroupFeed(tenantId, groupId, options = {}) {
        const { rows, total } = await social_group_repository_1.socialGroupRepository.getGroupFeed(tenantId, groupId, options);
        const posts = rows.map((row) => ({
            postId: row.post_id,
            content: row.content,
            globalUserId: row.global_user_id,
            createdAt: row.created_at,
            metadata: row.metadata || {},
            isAutoPost: row.metadata?.type === 'system_auto_post',
        }));
        const hasMore = (options.offset || 0) + posts.length < total;
        return {
            posts,
            total,
            hasMore,
        };
    }
    /**
     * Cria post dentro de um grupo
     */
    async createGroupPost(fastify, tenantId, groupId, globalUserId, input) {
        // Verificar se usuário é membro do grupo
        const members = await groups_repository_1.groupsRepository.getMembers(tenantId, groupId);
        const isMember = members.some((m) => m.userId === globalUserId);
        if (!isMember) {
            throw new Error('User is not a member of this group');
        }
        // Criar post com metadata.groupId
        const post = await social_service_1.socialService.createPost(fastify, tenantId, globalUserId, {
            ...input,
            metadata: {
                ...input.metadata,
                groupId,
            },
        });
        return post;
    }
    /**
     * Lista grupos do usuário com informações sociais
     */
    async getMyGroups(tenantId, userId) {
        const groups = await groups_service_1.groupsService.getUserGroups(tenantId, userId);
        const infos = await Promise.all(groups.map((g) => social_group_repository_1.socialGroupRepository.getGroupSocialInfo(tenantId, g.groupId)));
        return infos.filter((info) => info !== null);
    }
    /**
     * Busca feed de impacto combinado
     */
    async getImpactFeed(tenantId, userId, options = {}) {
        const { items, total } = await social_group_repository_1.socialGroupRepository.getImpactFeed(tenantId, userId, options);
        const feedItems = items.map((item) => {
            const metadata = item.metadata || {};
            const isAutoPost = metadata.type === 'system_auto_post';
            return {
                type: isAutoPost
                    ? 'economic_auto_post'
                    : metadata.groupId
                        ? 'group_post'
                        : 'user_activity',
                postId: item.post_id,
                content: item.content,
                globalUserId: item.global_user_id,
                groupId: metadata.groupId,
                amount: metadata.splitAmount,
                createdAt: item.created_at,
                metadata,
            };
        });
        const hasMore = (options.offset || 0) + feedItems.length < total;
        return {
            items: feedItems,
            total,
            hasMore,
        };
    }
    /**
     * Busca insights de um grupo
     */
    async getGroupInsights(tenantId, groupId) {
        return social_group_repository_1.socialGroupRepository.getGroupInsights(tenantId, groupId);
    }
}
exports.socialGroupService = new SocialGroupService();
//# sourceMappingURL=social-group.service.js.map