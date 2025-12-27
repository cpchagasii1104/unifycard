"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.social2Service = exports.Social2Service = void 0;
// src/modules/social/social-2.0.service.ts
const pool_1 = require("@core/database/pool");
const actor_repository_1 = require("./actor.repository");
class Social2Service {
    /**
     * Busca feed com cursor pagination (prioriza posts de actors seguidos)
     */
    async getFeed(tenantId, globalUserId, cursor, limit) {
        // Busca actor do usuário atual
        // FASE 3.6: Corrigir query - buscar user_id através de global_user_id em users ou user_identity_links
        const user = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT user_id FROM users
      WHERE global_user_id = $1
         OR user_id IN (
            SELECT user_id FROM user_identity_links WHERE global_user_id = $1
         )
      LIMIT 1
      `, [globalUserId]);
        let currentActorId = null;
        if (user) {
            const actor = await actor_repository_1.actorRepository.findOrCreateUserActor(tenantId, user.user_id, globalUserId);
            currentActorId = actor.actor_id;
        }
        let query = `
      SELECT 
        p.post_id,
        p.tenant_id,
        p.actor_id,
        p.global_user_id,
        p.content,
        p.media,
        p.intent,
        NULL::jsonb as intent_metadata,
        NULL::jsonb as targeting,
        p.created_at,
        p.updated_at,
        COALESCE(a.actor_id, NULL::uuid) as actor_actor_id,
        a.actor_type,
        a.display_name,
        a.avatar_url,
        a.cover_url,
        COALESCE((
          SELECT COUNT(*)::int
          FROM reactions r
          WHERE r.post_id = p.post_id
        ), 0) as reactions_count,
        COALESCE((
          SELECT COUNT(*)::int
          FROM comments c
          WHERE c.post_id = p.post_id AND c.is_deleted = false
        ), 0) as comments_count,
        (
          SELECT r.reaction_type
          FROM reactions r
          WHERE r.post_id = p.post_id AND r.global_user_id = $2
          LIMIT 1
        ) as user_reaction,
        CASE WHEN f.follow_id IS NOT NULL THEN true ELSE false END as is_followed,
        cta.cta_id,
        cta.cta_type,
        cta.target_actor_id,
        cta.target_group_id,
        cta.price,
        cta.currency,
        NULL::text as group_name,
        COALESCE((
          SELECT SUM(amount_cents)
          FROM social_ledger sl
          WHERE sl.post_id = p.post_id AND sl.amount_type = 'profit_share'
        ), 0) as total_impact_cents
      FROM posts p
      LEFT JOIN actors a ON p.actor_id = a.actor_id
      LEFT JOIN post_cta cta ON cta.post_id = p.post_id AND cta.is_active = true
      -- FASE 3.6: groups table não existe ainda, então group_name é NULL por enquanto
    `;
        const params = [tenantId, globalUserId];
        let paramIndex = 3;
        // Adiciona join de follows se houver actor atual
        if (currentActorId) {
            query += ` LEFT JOIN follows f ON f.actor_id = p.actor_id AND f.follower_actor_id = $${paramIndex}`;
            params.push(currentActorId);
            paramIndex++;
        }
        else {
            query += ` LEFT JOIN follows f ON false`;
        }
        query += ` WHERE p.tenant_id = $1`;
        if (cursor) {
            query += ` AND p.created_at < (SELECT created_at FROM posts WHERE post_id = $${paramIndex})`;
            params.push(cursor);
            paramIndex++;
        }
        // Buscar mais posts para permitir ranking por relevância
        // Ordenação final será feita após cálculo de relevância
        query += ` ORDER BY p.created_at DESC LIMIT $${paramIndex}`;
        params.push(Math.min(limit * 3, 100)); // Busca 3x o limite para ter opções de ranking
        const rows = await (0, pool_1.runQueriesWithTenant)(tenantId, query, params);
        // Buscar perfil CORE do usuário para calcular relevância
        let userCoreProfile = null;
        let userAge = undefined;
        try {
            const { coreService } = await Promise.resolve().then(() => __importStar(require('@core/core.service')));
            if (user) {
                userCoreProfile = await coreService.getCompleteProfile(tenantId, user.user_id, globalUserId);
                // Calcular idade se houver birthdate
                if (userCoreProfile?.personal_profile?.metadata?.birthdate) {
                    const birthdate = new Date(userCoreProfile.personal_profile.metadata.birthdate);
                    const today = new Date();
                    userAge = today.getFullYear() - birthdate.getFullYear();
                }
            }
        }
        catch (err) {
            console.warn('Erro ao buscar CORE profile para targeting (não crítico):', err);
        }
        // Calcular relevância e mapear posts
        const { socialTargetingService } = await Promise.resolve().then(() => __importStar(require('./social-targeting.service')));
        const { socialVotesService } = await Promise.resolve().then(() => __importStar(require('./social-votes.service')));
        // Calcular scores de relevância para todos os posts
        const postsWithScores = await Promise.all(rows.map(async (row) => {
            const targeting = null; // FASE 3.6: targeting não existe na tabela posts ainda
            const relevanceScore = userCoreProfile
                ? socialTargetingService.calculateRelevanceScore(targeting, userCoreProfile, row.is_followed || false, userAge)
                : { score: 50, breakdown: {} };
            // Buscar resultados de votação se o post for do tipo 'vote'
            let voteResults = undefined;
            if (row.intent === 'vote') {
                try {
                    voteResults = await socialVotesService.getVoteResults(tenantId, row.post_id);
                }
                catch (err) {
                    console.warn('Erro ao buscar resultados de votação (não crítico):', err);
                }
            }
            return {
                post_id: row.post_id,
                tenant_id: row.tenant_id,
                actor_id: row.actor_id,
                global_user_id: row.global_user_id,
                content: row.content,
                media: row.media || [],
                intent: row.intent || 'personal',
                intent_metadata: undefined, // FASE 3.6: intent_metadata não existe na tabela posts ainda
                targeting: targeting || undefined, // FASE 3.6: targeting não existe na tabela posts ainda
                created_at: row.created_at,
                updated_at: row.updated_at,
                actor: row.actor_actor_id
                    ? {
                        actor_id: row.actor_actor_id,
                        actor_type: row.actor_type,
                        display_name: row.display_name,
                        avatar_url: row.avatar_url,
                        cover_url: row.cover_url,
                    }
                    : {
                        actor_id: '',
                        actor_type: 'user',
                        display_name: 'Usuário',
                        avatar_url: null,
                        cover_url: null,
                    },
                reactions_count: row.reactions_count || 0,
                comments_count: row.comments_count || 0,
                user_reaction: row.user_reaction || null,
                relevance_score: relevanceScore.score,
                is_followed: row.is_followed || false,
                cta: row.cta_id
                    ? {
                        cta_id: row.cta_id,
                        cta_type: row.cta_type,
                        target_actor_id: row.target_actor_id,
                        target_group_id: row.target_group_id,
                        price: row.price ? parseFloat(row.price.toString()) : null,
                        currency: row.currency || 'BRL',
                    }
                    : undefined,
                social_impact: row.total_impact_cents > 0
                    ? {
                        group_name: row.group_name,
                        total_impact_cents: parseInt(row.total_impact_cents.toString(), 10),
                    }
                    : undefined,
                vote_results: voteResults ? {
                    options: voteResults.options,
                    total_votes: voteResults.total_votes,
                    closes_at: voteResults.closes_at,
                } : undefined,
            };
        }));
        // Ordenar por relevância (mantendo 20% discovery)
        const rankedPosts = socialTargetingService.rankPosts(postsWithScores, 20);
        const hasMore = rankedPosts.length > limit;
        const posts = hasMore ? rankedPosts.slice(0, limit) : rankedPosts;
        // Remover campos internos antes de retornar
        const cleanPosts = posts.map((p) => {
            const { is_followed, ...rest } = p;
            return rest;
        });
        return {
            posts: cleanPosts,
            next_cursor: hasMore && cleanPosts.length > 0 ? cleanPosts[cleanPosts.length - 1].post_id : null,
            has_more: hasMore,
        };
    }
    /**
     * Cria um novo post (com CTA opcional)
     */
    async createPost(tenantId, userId, globalUserId, content, actorId, mediaIds, intent, intentMetadata, targeting, cta) {
        // Busca ou cria actor
        let actor;
        if (actorId) {
            actor = await actor_repository_1.actorRepository.findById(tenantId, actorId);
            if (!actor) {
                throw new Error('Actor não encontrado');
            }
        }
        else {
            actor = await actor_repository_1.actorRepository.findOrCreateUserActor(tenantId, userId, globalUserId);
        }
        // Cria post com intent, intent_metadata e targeting
        const post = await (0, pool_1.runQueryWithTenant)(tenantId, `
      INSERT INTO posts (
        tenant_id, global_user_id, actor_id, content, media, intent, intent_metadata, targeting
      )
      VALUES ($1, $2, $3, $4, '[]'::jsonb, $5, $6::jsonb, $7::jsonb)
      RETURNING post_id, created_at, updated_at
      `, [
            tenantId,
            globalUserId,
            actor.actor_id,
            content,
            intent || 'personal',
            JSON.stringify(intentMetadata || {}),
            JSON.stringify(targeting || {}),
        ]);
        if (!post) {
            throw new Error('Erro ao criar post');
        }
        // Associa mídia se houver
        if (mediaIds.length > 0) {
            for (let i = 0; i < mediaIds.length; i++) {
                await (0, pool_1.runQueryWithTenant)(tenantId, `
          UPDATE post_media
          SET post_id = $1, display_order = $2
          WHERE media_id = $3 AND tenant_id = $4
          `, [post.post_id, i, mediaIds[i], tenantId]);
            }
        }
        // Cria projeto se intent = 'project'
        if (intent === 'project' && intentMetadata?.group_id) {
            try {
                await (0, pool_1.runQueryWithTenant)(tenantId, `
          INSERT INTO post_projects (
            post_id, tenant_id, group_id, budget_cents, deadline, status
          )
          VALUES ($1, $2, $3, $4, $5, 'active')
          `, [
                    post.post_id,
                    tenantId,
                    intentMetadata.group_id,
                    intentMetadata.budget_cents ? parseInt(intentMetadata.budget_cents.toString(), 10) : null,
                    intentMetadata.deadline ? new Date(intentMetadata.deadline) : null,
                ]);
            }
            catch (err) {
                console.error('Erro ao criar projeto (não crítico):', err);
                // Não quebra criação do post
            }
        }
        // Cria CTA se fornecido
        let createdCta = undefined;
        if (cta) {
            const ctaRow = await (0, pool_1.runQueryWithTenant)(tenantId, `
        INSERT INTO post_cta (
          tenant_id, post_id, cta_type, target_actor_id, target_group_id, price, currency, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING cta_id, cta_type, target_actor_id, target_group_id, price, currency
        `, [
                tenantId,
                post.post_id,
                cta.type,
                cta.target_actor_id || null,
                cta.target_group_id || null,
                cta.price || null,
                cta.currency || 'BRL',
                JSON.stringify(cta.metadata || {}),
            ]);
            if (ctaRow) {
                createdCta = {
                    cta_id: ctaRow.cta_id,
                    cta_type: ctaRow.cta_type,
                    target_actor_id: ctaRow.target_actor_id,
                    target_group_id: ctaRow.target_group_id,
                    price: ctaRow.price ? parseFloat(ctaRow.price.toString()) : null,
                    currency: ctaRow.currency,
                };
            }
        }
        return {
            post_id: post.post_id,
            tenant_id: tenantId,
            actor_id: actor.actor_id,
            global_user_id: globalUserId,
            content,
            media: [],
            intent: intent || 'personal',
            intent_metadata: intentMetadata,
            targeting,
            created_at: post.created_at,
            updated_at: post.updated_at,
            actor: {
                actor_id: actor.actor_id,
                actor_type: actor.actor_type,
                display_name: actor.display_name,
                avatar_url: actor.avatar_url,
                cover_url: actor.cover_url,
            },
            reactions_count: 0,
            comments_count: 0,
            user_reaction: null,
            cta: createdCta,
        };
    }
    /**
     * Adiciona ou atualiza reação
     */
    async toggleReaction(tenantId, postId, globalUserId, reactionType) {
        // Verifica se já existe
        const existing = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT reaction_id, reaction_type
      FROM reactions
      WHERE post_id = $1 AND global_user_id = $2
      LIMIT 1
      `, [postId, globalUserId]);
        if (existing) {
            if (existing.reaction_type === reactionType) {
                // Remove reação se for a mesma
                await (0, pool_1.runQueryWithTenant)(tenantId, `DELETE FROM reactions WHERE reaction_id = $1`, [existing.reaction_id]);
                return {
                    reaction_id: existing.reaction_id,
                    reaction_type: reactionType,
                    created_at: new Date().toISOString(),
                    is_new: false,
                };
            }
            else {
                // Atualiza tipo
                const updated = await (0, pool_1.runQueryWithTenant)(tenantId, `
          UPDATE reactions
          SET reaction_type = $1
          WHERE reaction_id = $2
          RETURNING reaction_id, created_at
          `, [reactionType, existing.reaction_id]);
                return {
                    reaction_id: updated.reaction_id,
                    reaction_type: reactionType,
                    created_at: updated.created_at,
                    is_new: false,
                };
            }
        }
        // Cria nova reação
        const newReaction = await (0, pool_1.runQueryWithTenant)(tenantId, `
      INSERT INTO reactions (tenant_id, post_id, global_user_id, reaction_type)
      VALUES ($1, $2, $3, $4)
      RETURNING reaction_id, created_at
      `, [tenantId, postId, globalUserId, reactionType]);
        if (!newReaction) {
            throw new Error('Erro ao criar reação');
        }
        return {
            reaction_id: newReaction.reaction_id,
            reaction_type: reactionType,
            created_at: newReaction.created_at,
            is_new: true,
        };
    }
    /**
     * Cria comentário
     */
    async createComment(tenantId, postId, globalUserId, content, parentCommentId) {
        const comment = await (0, pool_1.runQueryWithTenant)(tenantId, `
      INSERT INTO comments (
        tenant_id, post_id, global_user_id, content, parent_comment_id
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING comment_id, created_at
      `, [tenantId, postId, globalUserId, content, parentCommentId || null]);
        if (!comment) {
            throw new Error('Erro ao criar comentário');
        }
        // Busca actor do usuário
        const user = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT user_id FROM users
      WHERE user_id IN (
        SELECT user_id FROM global_users WHERE global_user_id = $1
      )
      LIMIT 1
      `, [globalUserId]);
        let actor = null;
        if (user) {
            actor = await actor_repository_1.actorRepository.findOrCreateUserActor(tenantId, user.user_id, globalUserId);
        }
        return {
            comment_id: comment.comment_id,
            post_id: postId,
            global_user_id: globalUserId,
            content,
            parent_comment_id: parentCommentId || null,
            created_at: comment.created_at,
            actor: actor
                ? {
                    actor_id: actor.actor_id,
                    display_name: actor.display_name,
                    avatar_url: actor.avatar_url,
                }
                : {
                    actor_id: '',
                    display_name: 'Usuário',
                    avatar_url: null,
                },
        };
    }
    /**
     * Busca posts de um actor
     */
    async getActorPosts(tenantId, actorId, limit) {
        const rows = await (0, pool_1.runQueriesWithTenant)(tenantId, `
      SELECT 
        p.post_id,
        p.tenant_id,
        p.actor_id,
        p.global_user_id,
        p.content,
        p.media,
        p.intent,
        NULL::jsonb as intent_metadata,
        NULL::jsonb as targeting,
        p.created_at,
        p.updated_at,
        COALESCE(a.actor_id, NULL::uuid) as actor_actor_id,
        a.actor_type,
        a.display_name,
        a.avatar_url,
        a.cover_url,
        COALESCE((
          SELECT COUNT(*)::int
          FROM reactions r
          WHERE r.post_id = p.post_id
        ), 0) as reactions_count,
        COALESCE((
          SELECT COUNT(*)::int
          FROM comments c
          WHERE c.post_id = p.post_id AND c.is_deleted = false
        ), 0) as comments_count,
        null as user_reaction,
        cta.cta_id,
        cta.cta_type,
        cta.target_actor_id,
        cta.target_group_id,
        cta.price,
        cta.currency,
        NULL::text as group_name,
        COALESCE((
          SELECT SUM(amount_cents)
          FROM social_ledger sl
          WHERE sl.post_id = p.post_id AND sl.amount_type = 'profit_share'
        ), 0) as total_impact_cents
      FROM posts p
      LEFT JOIN actors a ON p.actor_id = a.actor_id
      LEFT JOIN post_cta cta ON cta.post_id = p.post_id AND cta.is_active = true
      -- FASE 3.6: groups table não existe ainda, então group_name é NULL por enquanto
      WHERE p.tenant_id = $1 AND p.actor_id = $2
      ORDER BY p.created_at DESC
      LIMIT $3
      `, [tenantId, actorId, limit]);
        return rows.map((row) => ({
            post_id: row.post_id,
            tenant_id: row.tenant_id,
            actor_id: row.actor_id,
            global_user_id: row.global_user_id,
            content: row.content,
            media: row.media || [],
            intent: row.intent || 'personal',
            intent_metadata: row.intent_metadata ? (typeof row.intent_metadata === 'string' ? JSON.parse(row.intent_metadata) : row.intent_metadata) : undefined,
            targeting: row.targeting ? (typeof row.targeting === 'string' ? JSON.parse(row.targeting) : row.targeting) : undefined,
            created_at: row.created_at,
            updated_at: row.updated_at,
            actor: row.actor_actor_id
                ? {
                    actor_id: row.actor_actor_id,
                    actor_type: row.actor_type,
                    display_name: row.display_name,
                    avatar_url: row.avatar_url,
                    cover_url: row.cover_url,
                }
                : {
                    actor_id: '',
                    actor_type: 'user',
                    display_name: 'Usuário',
                    avatar_url: null,
                    cover_url: null,
                },
            reactions_count: row.reactions_count || 0,
            comments_count: row.comments_count || 0,
            user_reaction: row.user_reaction || null,
            cta: row.cta_id
                ? {
                    cta_id: row.cta_id,
                    cta_type: row.cta_type,
                    target_actor_id: row.target_actor_id,
                    target_group_id: row.target_group_id,
                    price: row.price ? parseFloat(row.price.toString()) : null,
                    currency: row.currency || 'BRL',
                }
                : undefined,
            social_impact: row.group_name && parseInt(row.total_impact_cents.toString(), 10) > 0
                ? {
                    group_name: row.group_name,
                    total_impact_cents: parseInt(row.total_impact_cents.toString(), 10),
                }
                : undefined,
        }));
    }
    /**
     * Segue um actor
     */
    async followActor(tenantId, followerActorId, targetActorId) {
        // Verifica se já está seguindo
        const existing = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT follow_id
      FROM follows
      WHERE actor_id = $1 AND follower_actor_id = $2
      LIMIT 1
      `, [targetActorId, followerActorId]);
        if (existing) {
            return { success: true, is_following: true };
        }
        // Cria follow
        await (0, pool_1.runQueryWithTenant)(tenantId, `
      INSERT INTO follows (tenant_id, actor_id, follower_actor_id)
      VALUES ($1, $2, $3)
      `, [tenantId, targetActorId, followerActorId]);
        return { success: true, is_following: true };
    }
    /**
     * Deixa de seguir um actor
     */
    async unfollowActor(tenantId, followerActorId, targetActorId) {
        await (0, pool_1.runQueryWithTenant)(tenantId, `
      DELETE FROM follows
      WHERE actor_id = $1 AND follower_actor_id = $2
      `, [targetActorId, followerActorId]);
        return { success: true, is_following: false };
    }
    /**
     * Verifica se está seguindo
     */
    async isFollowing(tenantId, followerActorId, targetActorId) {
        const result = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT follow_id
      FROM follows
      WHERE actor_id = $1 AND follower_actor_id = $2
      LIMIT 1
      `, [targetActorId, followerActorId]);
        return !!result;
    }
    /**
     * Busca contadores de um actor
     */
    async getActorCounts(tenantId, actorId) {
        const result = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT 
        COALESCE((
          SELECT COUNT(*)::int
          FROM follows f
          WHERE f.actor_id = $1
        ), 0) as followers_count,
        COALESCE((
          SELECT COUNT(*)::int
          FROM posts p
          WHERE p.actor_id = $1
        ), 0) as posts_count
      `, [actorId]);
        return result || { followers_count: 0, posts_count: 0 };
    }
    /**
     * Busca actor de um usuário (helper para outras rotas)
     */
    async getUserActor(tenantId, globalUserId) {
        try {
            const user = await (0, pool_1.runQueryWithTenant)(tenantId, `
        SELECT user_id FROM users
        WHERE global_user_id = $1 AND tenant_id = $2
        LIMIT 1
        `, [globalUserId, tenantId]);
            if (!user) {
                return null;
            }
            const actor = await actor_repository_1.actorRepository.findOrCreateUserActor(tenantId, user.user_id, globalUserId);
            return { actor_id: actor.actor_id };
        }
        catch (err) {
            console.error('Erro ao buscar actor do usuário:', err);
            return null;
        }
    }
}
exports.Social2Service = Social2Service;
exports.social2Service = new Social2Service();
//# sourceMappingURL=social-2.0.service.js.map