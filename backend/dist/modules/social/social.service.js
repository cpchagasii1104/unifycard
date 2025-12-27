"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.socialService = void 0;
const social_repository_1 = require("./social.repository");
const social_model_1 = require("./social.model");
const categories_service_1 = require("@core/categories/categories.service");
const orchestrator_service_1 = require("@core/orchestrator/orchestrator.service");
class SocialService {
    repository = new social_repository_1.SocialRepository();
    /**
     * Cria um novo post com análise automática de intent e categorias
     */
    async createPost(fastify, tenantId, globalUserId, input) {
        // 1. Classificar texto em categorias (se não fornecido)
        let detectedCategories = input.categories || [];
        if (detectedCategories.length === 0) {
            const categoryClassifications = await categories_service_1.categoriesService.classifyTextIntoCategories({
                text: input.content,
                maxCategories: 5,
            });
            detectedCategories = categoryClassifications.map((c) => c.categoryId);
        }
        // 2. Analisar texto com orchestrator para detectar intent (se não fornecido)
        let detectedIntent = input.intent || null;
        let confidence = null;
        let suggestedActions = [];
        let analysis = null;
        if (!input.intent) {
            try {
                analysis = await orchestrator_service_1.orchestratorService.analyzeText(fastify, {
                    text: input.content,
                    context: {
                        userId: globalUserId,
                    },
                }, globalUserId, tenantId);
                // Pegar intent principal se confiança >= 0.7
                const primaryIntent = analysis.intents[0];
                if (primaryIntent && primaryIntent.confidence >= 0.7) {
                    detectedIntent = primaryIntent.intent;
                    confidence = primaryIntent.confidence;
                    suggestedActions = analysis.suggestedActions || [];
                }
            }
            catch (error) {
                // Silenciosamente ignora erros de análise (não quebra criação do post)
                console.warn('Erro ao analisar intent do post:', error);
            }
        }
        else {
            // Se intent foi fornecida manualmente, buscar ações sugeridas
            try {
                analysis = await orchestrator_service_1.orchestratorService.analyzeText(fastify, {
                    text: input.content,
                    context: {
                        userId: globalUserId,
                    },
                }, globalUserId, tenantId);
                suggestedActions = analysis.suggestedActions || [];
                confidence = 1.0; // Se fornecido manualmente, confiança máxima
            }
            catch (error) {
                // Silenciosamente ignora
            }
        }
        // 3. Preparar metadata com informações de serviço (se for post de serviço)
        const metadata = {
            ...(input.metadata || {}),
        };
        if (input.isServicePost && input.serviceInfo) {
            metadata.isServicePost = true;
            metadata.serviceInfo = {
                categoryId: input.serviceInfo.categoryId,
                categoryName: input.serviceInfo.categoryName,
                price: input.serviceInfo.price,
                pricingType: input.serviceInfo.pricingType || 'quote',
                currency: input.serviceInfo.currency || 'BRL',
                description: input.serviceInfo.description,
                duration: input.serviceInfo.duration,
                requiresSchedule: input.serviceInfo.requiresSchedule !== false, // Default true
                requiresPayment: input.serviceInfo.requiresPayment || false,
            };
        }
        // 4. Criar post no banco
        const row = await this.repository.create({
            tenantId,
            globalUserId,
            content: input.content,
            media: input.media || [],
            intent: detectedIntent,
            confidence,
            categories: detectedCategories,
            suggestedActions,
            metadata,
        });
        return social_model_1.SocialModel.fromRow(row);
    }
    /**
     * Busca post por ID
     */
    async getPost(tenantId, postId) {
        const row = await this.repository.findById(tenantId, postId);
        return row ? social_model_1.SocialModel.fromRow(row) : null;
    }
    /**
     * Busca feed de posts
     */
    async getFeed(tenantId, options = {}) {
        const { rows, total } = await this.repository.findFeed(tenantId, {
            limit: options.limit,
            offset: options.offset,
            categoryId: options.categoryId,
            intent: options.intent,
            userId: options.userId,
            startDate: options.startDate,
            endDate: options.endDate,
        });
        const posts = social_model_1.SocialModel.fromRows(rows);
        const hasMore = (options.offset || 0) + posts.length < total;
        return {
            posts,
            total,
            hasMore,
        };
    }
    /**
     * Vincula um job a um post
     */
    async linkJobToPost(postId, jobId, tenantId) {
        // Buscar post atual
        const post = await this.getPost(tenantId, postId);
        if (!post) {
            throw new Error('Post not found');
        }
        // Atualizar metadata com jobId
        const updatedMetadata = {
            ...post.metadata,
            jobId,
        };
        // Atualizar post no banco
        await this.repository.updateMetadata(tenantId, postId, updatedMetadata);
    }
}
exports.socialService = new SocialService();
//# sourceMappingURL=social.service.js.map