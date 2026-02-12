"use strict";
// src/modules/social/social-2.0.routes.ts
// Rotas do Social 2.0 - Feed, Posts, Reactions, Comments, Actors, Ledger
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
const social_2_0_service_1 = require("./social-2.0.service");
const actor_repository_1 = require("./actor.repository");
const social_ledger_service_1 = require("./social-ledger.service");
const social_votes_service_1 = require("./social-votes.service");
const actor_utils_1 = require("./actor.utils");
const actor_audit_service_1 = require("./actor-audit.service");
const pool_1 = require("@core/database/pool");
const zod_1 = require("zod");
const createPostSchema = zod_1.z.object({
    content: zod_1.z.string().min(1),
    actor_id: zod_1.z.string().uuid().optional(),
    media_ids: zod_1.z.array(zod_1.z.string().uuid()).optional(),
    intent: zod_1.z.enum(['personal', 'friends', 'booking', 'service_offer', 'product_offer', 'project', 'vote', 'event']).optional(),
    intent_metadata: zod_1.z.record(zod_1.z.any()).optional(),
    targeting: zod_1.z.object({
        demographics: zod_1.z.object({
            age_range: zod_1.z.array(zod_1.z.number()).length(2).optional(),
            gender: zod_1.z.array(zod_1.z.enum(['male', 'female', 'other'])).optional(),
        }).optional(),
        lifestyle: zod_1.z.object({
            drinks: zod_1.z.boolean().optional(),
            smokes: zod_1.z.boolean().optional(),
        }).optional(),
        mobility: zod_1.z.object({
            has_car: zod_1.z.boolean().optional(),
            uses_bike: zod_1.z.boolean().optional(),
            uses_skate: zod_1.z.boolean().optional(),
        }).optional(),
        interests: zod_1.z.array(zod_1.z.string().uuid()).optional(),
        professions: zod_1.z.array(zod_1.z.string().uuid()).optional(),
        locations: zod_1.z.object({
            radius_km: zod_1.z.number().optional(),
            city_id: zod_1.z.string().uuid().optional(),
        }).optional(),
    }).optional(),
    cta: zod_1.z.object({
        type: zod_1.z.enum(['booking', 'service', 'payment']),
        target_actor_id: zod_1.z.string().uuid().optional(),
        target_group_id: zod_1.z.string().uuid().optional(),
        price: zod_1.z.number().positive().optional(),
        currency: zod_1.z.string().optional(),
        metadata: zod_1.z.record(zod_1.z.any()).optional(),
    }).optional(),
    group_id: zod_1.z.string().uuid().optional(), // ID do grupo para vincular o post
});
const reactionSchema = zod_1.z.object({
    reaction_type: zod_1.z.enum(['like', 'love', 'haha', 'wow', 'sad', 'angry']).default('like'),
});
const commentSchema = zod_1.z.object({
    content: zod_1.z.string().min(1),
    parent_comment_id: zod_1.z.string().uuid().optional(),
});
const social2Routes = async (fastify) => {
    /**
     * GET /social/feed?cursor=&actor_type=&actor_id=&group_id=
     * Feed com cursor pagination e modo de atuação (PF vs PJ)
     * Quando group_id é fornecido, retorna apenas posts do grupo
     */
    fastify.get('/feed', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        // ActionContext é obrigatório (V2)
        if (!req.actionContext || !req.actionContext.actorId) {
            return reply.status(400).send({ error: 'ActionContext obrigatório' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const cursor = req.query.cursor;
            const limit = parseInt(req.query.limit || '20', 10);
            const safeLimit = Math.min(Math.max(1, limit), 50);
            // REGRA: actor_type é OBRIGATÓRIO (não pode ser genérico)
            const actorType = req.query.actor_type;
            if (!actorType || (actorType !== 'user' && actorType !== 'page')) {
                return reply.status(400).send({
                    error: 'actor_type é obrigatório e deve ser "user" (Pessoa Física) ou "page" (Pessoa Jurídica)'
                });
            }
            const actorId = req.query.actor_id || undefined;
            const actorStatus = req.query.actor_status || undefined; // Status da empresa
            // EVENTOS ÂNCORA: Preferências e geolocalização (opcionais)
            let userPreferences = undefined;
            if (req.query.user_preferences) {
                try {
                    userPreferences = JSON.parse(req.query.user_preferences);
                }
                catch (err) {
                    fastify.log.warn({ err }, 'Erro ao parsear user_preferences (ignorando)');
                }
            }
            let userLocation = undefined;
            if (req.query.user_location) {
                try {
                    userLocation = JSON.parse(req.query.user_location);
                    // Validar coordenadas
                    if (typeof userLocation.lat !== 'number' || typeof userLocation.lng !== 'number') {
                        userLocation = undefined;
                    }
                }
                catch (err) {
                    fastify.log.warn({ err }, 'Erro ao parsear user_location (ignorando)');
                }
            }
            const groupId = req.query.group_id || undefined;
            const feed = await social_2_0_service_1.social2Service.getFeed(req.tenant.id, req.actionContext.actorId, cursor, safeLimit, actorType, actorId, actorStatus, userPreferences, userLocation, groupId);
            return reply.send(feed);
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar feed');
            return reply.status(500).send({ error: 'Erro ao buscar feed' });
        }
    });
    /**
     * POST /social/posts
     * Cria um novo post
     */
    fastify.post('/posts', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        // ActionContext é obrigatório (V2)
        if (!req.actionContext || !req.actionContext.actorId) {
            return reply.status(400).send({ error: 'ActionContext obrigatório' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const validated = createPostSchema.parse(req.body);
            // ActionContext é obrigatório (V2)
            if (!req.actionContext || !req.actionContext.actorId) {
                return reply.status(400).send({ error: 'ActionContext obrigatório' });
            }
            const createdAsActorId = req.actionContext.actorId;
            // CONTINUOUS PRODUCTION: Verificar permissão específica para publicar feed
            // Action context já foi resolvido pelo middleware
            if (actionContext && validated.actor_id) {
                const { requirePermission } = await Promise.resolve().then(() => __importStar(require('@core/authorization/require-permission.guard')));
                const guard = requirePermission('publish_feed');
                await guard(req, reply);
                // Se guard retornou resposta, parar execução
                if (reply.sent) {
                    return;
                }
            }
            const post = await social_2_0_service_1.social2Service.createPost(req.tenant.id, req.actionContext.actorId, req.actionContext.actorId, validated.content, validated.actor_id, validated.media_ids || [], validated.intent, validated.intent_metadata, validated.targeting, validated.cta, validated.group_id, // Passar groupId para o service
            createdByUserId, // CONTINUOUS PRODUCTION: Audit field
            createdAsActorId // CONTINUOUS PRODUCTION: Audit field
            );
            return reply.status(201).send(post);
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return reply.status(400).send({ error: 'Dados inválidos', details: error.errors });
            }
            fastify.log.error({ err: error }, 'Erro ao criar post');
            return reply.status(500).send({ error: 'Erro ao criar post' });
        }
    });
    /**
     * POST /social/posts/:id/reactions
     * Adiciona ou atualiza reação
     */
    fastify.post('/posts/:id/reactions', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        // ActionContext é obrigatório (V2)
        if (!req.actionContext || !req.actionContext.actorId) {
            return reply.status(400).send({ error: 'ActionContext obrigatório' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const validated = reactionSchema.parse(req.body);
            // Buscar actor ativo (pode ser empresa se estiver atuando como empresa)
            const actorId = req.query.actor_id || undefined;
            const actorType = req.query.actor_type;
            const reaction = await social_2_0_service_1.social2Service.toggleReaction(req.tenant.id, req.params.id, req.actionContext.actorId, validated.reaction_type, actorId, actorType);
            return reply.send(reaction);
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return reply.status(400).send({ error: 'Dados inválidos', details: error.errors });
            }
            fastify.log.error({ err: error }, 'Erro ao adicionar reação');
            return reply.status(500).send({ error: 'Erro ao adicionar reação' });
        }
    });
    /**
     * GET /social/posts/:id/comments?cursor&limit
     * Busca comentários de um post
     */
    fastify.get('/posts/:id/comments', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const cursor = req.query.cursor;
            const limit = parseInt(req.query.limit || '20', 10);
            const safeLimit = Math.min(Math.max(1, limit), 50);
            const result = await social_2_0_service_1.social2Service.getComments(req.tenant.id, req.params.id, cursor, safeLimit);
            return reply.send(result);
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar comentários');
            return reply.status(500).send({ error: 'Erro ao buscar comentários' });
        }
    });
    /**
     * POST /social/posts/:id/comments
     * Adiciona comentário
     */
    fastify.post('/posts/:id/comments', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        // ActionContext é obrigatório (V2)
        if (!req.actionContext || !req.actionContext.actorId) {
            return reply.status(400).send({ error: 'ActionContext obrigatório' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const validated = commentSchema.parse(req.body);
            const comment = await social_2_0_service_1.social2Service.createComment(req.tenant.id, req.params.id, req.actionContext.actorId, validated.content, validated.parent_comment_id);
            return reply.status(201).send(comment);
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return reply.status(400).send({ error: 'Dados inválidos', details: error.errors });
            }
            fastify.log.error({ err: error }, 'Erro ao criar comentário');
            return reply.status(500).send({ error: 'Erro ao criar comentário' });
        }
    });
    /**
     * GET /social/actors/available
     * Lista actors disponíveis para o usuário (pessoal + empresas com permissão)
     */
    fastify.get('/actors/available', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            if (!req.actionContext || !req.actionContext.actorId) {
                return reply.status(400).send({ error: 'ActionContext obrigatório' });
            }
            const actorId = req.actionContext.actorId;
            const actors = await actor_repository_1.actorRepository.findAvailableActors(req.tenant.id, actorId);
            // 🔴 AUDITORIA: Registrar troca de actor se houver mudança
            // (Frontend pode chamar endpoint específico para registrar troca explícita)
            // Por enquanto, apenas retornar actors disponíveis
            return reply.send({ actors });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar actors disponíveis');
            return reply.status(500).send({ error: 'Erro ao buscar actors disponíveis' });
        }
    });
    /**
     * POST /social/actors/switch
     * Registra troca de Actor ativo (auditoria)
     * 🔴 BLINDAGEM: Evento interno para auditoria, debugging e segurança
     * NÃO é feed, NÃO é visível ao usuário final
     */
    fastify.post('/actors/switch', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            if (!req.actionContext || !req.actionContext.actorId) {
                return reply.status(400).send({ error: 'ActionContext obrigatório' });
            }
            const actorId = req.actionContext.actorId;
            const { from_actor_id, to_actor_id } = req.body;
            // Validar que to_actor_id existe e pertence ao usuário
            const toActor = await actor_repository_1.actorRepository.findById(req.tenant.id, to_actor_id);
            if (!toActor) {
                return reply.status(404).send({ error: 'Actor de destino não encontrado' });
            }
            // Verificar se usuário tem acesso ao actor
            const availableActors = await actor_repository_1.actorRepository.findAvailableActors(req.tenant.id, userId);
            const hasAccess = availableActors.some(a => a.actor_id === to_actor_id);
            if (!hasAccess) {
                return reply.status(403).send({ error: 'Acesso negado ao actor' });
            }
            // Registrar evento de auditoria
            await (0, actor_audit_service_1.recordActorSwitch)(req.tenant.id, userId, from_actor_id || null, to_actor_id, {
                route: req.url,
                method: req.method,
            });
            return reply.send({ ok: true, message: 'Troca de actor registrada' });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao registrar troca de actor');
            return reply.status(500).send({ error: 'Erro ao registrar troca de actor' });
        }
    });
    /**
     * GET /social/actors/:id
     * Busca perfil/página do actor
     */
    fastify.get('/actors/:id', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const actor = await actor_repository_1.actorRepository.findById(req.tenant.id, req.params.id);
            if (!actor) {
                return reply.status(404).send({ error: 'Actor não encontrado' });
            }
            // Busca posts do actor
            const posts = await social_2_0_service_1.social2Service.getActorPosts(req.tenant.id, req.params.id, 20);
            // Busca contadores
            const counts = await social_2_0_service_1.social2Service.getActorCounts(req.tenant.id, req.params.id);
            // Verifica se o usuário atual está seguindo
            let isFollowing = false;
            if (req.user?.globalUserId) {
                const user = await (0, pool_1.runQueryWithTenant)(req.tenant.id, `
          SELECT user_id FROM users
          WHERE user_id IN (
            SELECT user_id FROM global_users WHERE global_user_id = $1
          )
          LIMIT 1
          `, [req.actionContext.actorId]);
                if (user) {
                    const currentActor = await actor_repository_1.actorRepository.findOrCreateUserActor(req.tenant.id, user.user_id);
                    isFollowing = await social_2_0_service_1.social2Service.isFollowing(req.tenant.id, currentActor.actor_id, req.params.id);
                }
            }
            return reply.send({
                actor,
                posts,
                counts,
                is_following: isFollowing,
            });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar actor');
            return reply.status(500).send({ error: 'Erro ao buscar actor' });
        }
    });
    /**
     * POST /social/actors/:id/follow
     * Segue um actor
     */
    fastify.post('/actors/:id/follow', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        // ActionContext é obrigatório (V2)
        if (!req.actionContext || !req.actionContext.actorId) {
            return reply.status(400).send({ error: 'ActionContext obrigatório' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const user = await (0, pool_1.runQueryWithTenant)(req.tenant.id, `
        SELECT user_id FROM users
        WHERE user_id IN (
          SELECT user_id FROM global_users WHERE global_user_id = $1
        )
        LIMIT 1
        `, [req.actionContext.actorId]);
            if (!user) {
                return reply.status(404).send({ error: 'Usuário não encontrado' });
            }
            const currentActor = await actor_repository_1.actorRepository.findOrCreateUserActor(req.tenant.id, user.user_id);
            const result = await social_2_0_service_1.social2Service.followActor(req.tenant.id, currentActor.actor_id, req.params.id);
            return reply.send(result);
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao seguir actor');
            return reply.status(500).send({ error: 'Erro ao seguir actor' });
        }
    });
    /**
     * POST /social/actors/:id/unfollow
     * Deixa de seguir um actor
     */
    fastify.post('/actors/:id/unfollow', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        // ActionContext é obrigatório (V2)
        if (!req.actionContext || !req.actionContext.actorId) {
            return reply.status(400).send({ error: 'ActionContext obrigatório' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const user = await (0, pool_1.runQueryWithTenant)(req.tenant.id, `
        SELECT user_id FROM users
        WHERE user_id IN (
          SELECT user_id FROM global_users WHERE global_user_id = $1
        )
        LIMIT 1
        `, [req.actionContext.actorId]);
            if (!user) {
                return reply.status(404).send({ error: 'Usuário não encontrado' });
            }
            const currentActor = await actor_repository_1.actorRepository.findOrCreateUserActor(req.tenant.id, user.user_id);
            const result = await social_2_0_service_1.social2Service.unfollowActor(req.tenant.id, currentActor.actor_id, req.params.id);
            return reply.send(result);
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao deixar de seguir actor');
            return reply.status(500).send({ error: 'Erro ao deixar de seguir actor' });
        }
    });
    /**
     * GET /social/ledger
     * Busca ledger do usuário (ganhos pessoais + repasses)
     */
    fastify.get('/ledger', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        // ActionContext é obrigatório (V2)
        if (!req.actionContext || !req.actionContext.actorId) {
            return reply.status(400).send({ error: 'ActionContext obrigatório' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const limit = parseInt(req.query.limit || '50', 10);
            const entries = await social_ledger_service_1.socialLedgerService.getUserLedger(req.tenant.id, req.actionContext.actorId, limit);
            return reply.send({ entries });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar ledger');
            return reply.status(500).send({ error: 'Erro ao buscar ledger' });
        }
    });
    /**
     * GET /social/ledger/summary
     * Resumo do ledger do usuário
     */
    fastify.get('/ledger/summary', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        // ActionContext é obrigatório (V2)
        if (!req.actionContext || !req.actionContext.actorId) {
            return reply.status(400).send({ error: 'ActionContext obrigatório' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const summary = await social_ledger_service_1.socialLedgerService.getUserLedgerSummary(req.tenant.id, req.actionContext.actorId);
            return reply.send(summary);
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar resumo do ledger');
            return reply.status(500).send({ error: 'Erro ao buscar resumo do ledger' });
        }
    });
    /**
     * POST /social/cta/:cta_id/confirm
     * Confirma CTA e gera transação real (ledger)
     */
    fastify.post('/cta/:cta_id/confirm', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        // ActionContext é obrigatório (V2)
        if (!req.actionContext || !req.actionContext.actorId) {
            return reply.status(400).send({ error: 'ActionContext obrigatório' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const { socialLedgerService } = await Promise.resolve().then(() => __importStar(require('./social-ledger.service')));
            const { actorRepository } = await Promise.resolve().then(() => __importStar(require('./actor.repository')));
            // Buscar CTA
            const ctaRow = await (0, pool_1.runQueryWithTenant)(req.tenant.id, `
        SELECT cta_id, post_id, cta_type, target_actor_id, target_group_id, price, currency
        FROM post_cta
        WHERE cta_id = $1 AND tenant_id = $2 AND is_active = true
        LIMIT 1
        `, [req.params.cta_id, req.tenant.id]);
            if (!ctaRow) {
                return reply.status(404).send({ error: 'CTA não encontrado ou inativo' });
            }
            const cta = ctaRow;
            // Buscar actor do usuário atual
            const user = await (0, pool_1.runQueryWithTenant)(req.tenant.id, `
        SELECT user_id FROM users
        WHERE global_user_id = $1 AND tenant_id = $2
        LIMIT 1
        `, [req.actionContext.actorId, req.tenant.id]);
            if (!user) {
                return reply.status(404).send({ error: 'Usuário não encontrado' });
            }
            const currentActor = await actorRepository.findOrCreateUserActor(req.tenant.id, user.user_id);
            // Buscar actor destinatário (se houver)
            let recipientActorId = null;
            if (cta.target_actor_id) {
                recipientActorId = cta.target_actor_id;
            }
            // Calcular valor em centavos
            const amountCents = cta.price ? Math.round(parseFloat(cta.price.toString()) * 100) : 0;
            if (amountCents <= 0) {
                return reply.status(400).send({ error: 'Valor inválido' });
            }
            // Gerar idempotency_key único
            const idempotencyKey = `cta_${cta.cta_id}_${req.actionContext.actorId}_${Date.now()}`;
            // Criar entrada de receita para o destinatário
            const revenueEntry = await socialLedgerService.recordEntry(req.tenant.id, {
                post_id: cta.post_id,
                cta_id: cta.cta_id,
                recipient_actor_id: recipientActorId || undefined,
                owner_actor_id: currentActor.actor_id,
                amount_cents: amountCents,
                currency: cta.currency || 'BRL',
                amount_type: 'revenue',
                description: `Receita de ${cta.cta_type === 'booking' ? 'agendamento' : cta.cta_type === 'service' ? 'serviço' : 'pagamento'}`,
                metadata: {
                    notes: req.body.notes,
                    confirmedAt: new Date().toISOString(),
                },
                idempotency_key: `${idempotencyKey}_revenue`,
            });
            // Se houver grupo configurado, calcular e criar repasse (profit_share)
            let profitShareEntry = null;
            if (cta.target_group_id) {
                // Buscar percentual do grupo
                const group = await (0, pool_1.runQueryWithTenant)(req.tenant.id, `
          SELECT profit_percentage FROM groups
          WHERE group_id = $1 AND tenant_id = $2
          LIMIT 1
          `, [cta.target_group_id, req.tenant.id]);
                if (group && group.profit_percentage && group.profit_percentage > 0) {
                    const profitShareCents = Math.round((amountCents * group.profit_percentage) / 100);
                    if (profitShareCents > 0) {
                        profitShareEntry = await socialLedgerService.recordEntry(req.tenant.id, {
                            post_id: cta.post_id,
                            cta_id: cta.cta_id,
                            recipient_group_id: cta.target_group_id,
                            owner_actor_id: currentActor.actor_id,
                            amount_cents: profitShareCents,
                            currency: cta.currency || 'BRL',
                            amount_type: 'profit_share',
                            description: `Repasse de ${group.profit_percentage}% para grupo`,
                            metadata: {
                                original_amount_cents: amountCents,
                                percentage: group.profit_percentage,
                            },
                            idempotency_key: `${idempotencyKey}_profit_share`,
                        });
                    }
                }
            }
            // FASE 10: Registrar impacto quando CTA é confirmado (SUPPORT)
            try {
                const { impactService } = await Promise.resolve().then(() => __importStar(require('./impact.service')));
                // Determinar se é projeto (se tem target_group_id, pode ser projeto)
                const sourceType = cta.target_group_id ? 'project' : 'post';
                const sourceId = cta.target_group_id || cta.post_id;
                await impactService.recordImpact({
                    tenantId: req.tenant.id,
                    actor: {
                        actor_id: currentActor.actor_id,
                        actor_type: currentActor.actor_type,
                    },
                    eventType: 'SUPPORT',
                    delta: 5,
                    sourceType: sourceType,
                    sourceId: sourceId,
                    metadata: {
                        cta_id: cta.cta_id,
                        cta_type: cta.cta_type,
                        target_group_id: cta.target_group_id,
                    },
                });
            }
            catch (err) {
                // Não quebra confirmação se impacto falhar (log apenas)
                fastify.log.warn({ err }, 'Erro ao registrar impacto de support (não crítico)');
            }
            return reply.status(201).send({
                success: true,
                revenue_entry: revenueEntry,
                profit_share_entry: profitShareEntry,
                message: 'Transação confirmada com sucesso',
            });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao confirmar CTA');
            // Se erro de idempotência, retornar sucesso (já foi processado)
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('duplicate') || errorMessage.includes('unique')) {
                return reply.status(200).send({
                    success: true,
                    message: 'Transação já foi processada anteriormente',
                });
            }
            return reply.status(500).send({ error: 'Erro ao confirmar CTA' });
        }
    });
    /**
     * POST /social/posts/:post_id/vote
     * Registra voto em uma votação (apenas membros do grupo)
     */
    fastify.post('/posts/:post_id/vote', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ ok: false, message: 'Não autenticado' });
        }
        // ActionContext é obrigatório (V2)
        if (!req.actionContext || !req.actionContext.actorId) {
            return reply.status(400).send({ error: 'ActionContext obrigatório' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
        }
        try {
            // Buscar actor do usuário
            const user = await (0, pool_1.runQueryWithTenant)(req.tenant.id, `
        SELECT user_id FROM users
        WHERE global_user_id = $1 AND tenant_id = $2
        LIMIT 1
        `, [req.actionContext.actorId, req.tenant.id]);
            if (!user) {
                return reply.status(404).send({ ok: false, message: 'Usuário não encontrado' });
            }
            // 🔴 CORREÇÃO CRÍTICA: Resolver actor ativo usando função canônica
            // Prioridade: header x-actor-id > query actor_id > erro (sem fallback silencioso)
            const currentActor = await (0, actor_utils_1.resolveActiveActorFromRequest)(req, req.tenant.id, {
                allowUserFallback: false, // Não permitir fallback silencioso para PF
            });
            // Buscar status da empresa se for PJ
            let companyStatus = undefined;
            if (currentActor.actor_type === 'page' && currentActor.company_id) {
                const company = await (0, pool_1.runQueryWithTenant)(req.tenant.id, `
          SELECT company_status FROM companies
          WHERE company_id = $1 AND tenant_id = $2
          LIMIT 1
          `, [currentActor.company_id, req.tenant.id]);
                companyStatus = company?.company_status;
            }
            const result = await social_votes_service_1.socialVotesService.castVote(req.tenant.id, req.params.post_id, currentActor.actor_id, req.body.option_index, user.user_id);
            return reply.send({ ok: true, data: result });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao registrar voto');
            return reply.status(400).send({
                ok: false,
                message: error instanceof Error ? error.message : 'Erro ao registrar voto',
            });
        }
    });
    /**
     * GET /social/posts/:post_id/vote/results
     * Busca resultados de uma votação
     */
    fastify.get('/posts/:post_id/vote/results', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ ok: false, message: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
        }
        try {
            const results = await social_votes_service_1.socialVotesService.getVoteResults(req.tenant.id, req.params.post_id);
            if (!results) {
                return reply.status(404).send({ ok: false, message: 'Votação não encontrada' });
            }
            return reply.send({ ok: true, data: results });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar resultados da votação');
            return reply.status(500).send({
                ok: false,
                message: 'Erro ao buscar resultados da votação',
            });
        }
    });
    // NOTA: Rotas duplicadas removidas para evitar FST_ERR_DUPLICATED_ROUTE
    // As rotas canônicas são:
    // - POST /social/posts/:post_id/vote (linha 651)
    // - GET /social/posts/:post_id/vote/results (linha 707)
    /**
     * GET /impact/balance
     * Busca saldo de impacto do ator ativo
     * FASE 10: Impacto Real + Ledger por Ator
     */
    fastify.get('/impact/balance', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const { impactService } = await Promise.resolve().then(() => __importStar(require('./impact.service')));
            const actorId = req.query.actor_id;
            const actorType = req.query.actor_type;
            if (!actorId || !actorType) {
                return reply.status(400).send({
                    error: 'actor_id e actor_type são obrigatórios'
                });
            }
            const balance = await impactService.getBalance(req.tenant.id, actorId, actorType);
            return reply.send({
                actor_id: balance.actor_id,
                actor_type: balance.actor_type,
                balance: balance.balance,
            });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar saldo de impacto');
            return reply.status(500).send({ error: 'Erro ao buscar saldo de impacto' });
        }
    });
    /**
     * GET /impact/ledger
     * Busca histórico do ledger de impacto (extrato)
     * FASE 10: Impacto Real + Ledger por Ator
     */
    fastify.get('/impact/ledger', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const { impactService } = await Promise.resolve().then(() => __importStar(require('./impact.service')));
            const actorId = req.query.actor_id;
            const actorType = req.query.actor_type;
            const limit = parseInt(req.query.limit || '20', 10);
            if (!actorId || !actorType) {
                return reply.status(400).send({
                    error: 'actor_id e actor_type são obrigatórios'
                });
            }
            const history = await impactService.getLedgerHistory(req.tenant.id, actorId, actorType, limit);
            return reply.send({ entries: history });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar histórico de impacto');
            return reply.status(500).send({ error: 'Erro ao buscar histórico de impacto' });
        }
    });
    /**
     * GET /reputation/permissions
     * Busca permissões do ator baseado em reputação e status
     * FASE 11: Reputação Progressiva & Permissões
     */
    fastify.get('/reputation/permissions', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const { reputationService } = await Promise.resolve().then(() => __importStar(require('./reputation.service')));
            const actorId = req.query.actor_id;
            const actorType = req.query.actor_type;
            const companyStatus = req.query.company_status;
            if (!actorId || !actorType) {
                return reply.status(400).send({
                    error: 'actor_id e actor_type são obrigatórios'
                });
            }
            const permissions = await reputationService.getPermissions(req.tenant.id, actorId, actorType, companyStatus);
            return reply.send(permissions);
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar permissões');
            return reply.status(500).send({ error: 'Erro ao buscar permissões' });
        }
    });
};
exports.default = social2Routes;
