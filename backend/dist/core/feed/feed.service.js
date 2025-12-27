"use strict";
// src/core/feed/feed.service.ts
// Serviço de Feed Contextual - conteúdo que encontra a pessoa
Object.defineProperty(exports, "__esModule", { value: true });
exports.feedService = void 0;
const profile_inference_service_1 = require("../profile/profile-inference.service");
class FeedService {
    /**
     * Gera feed contextual baseado no estado inferido do usuário
     */
    async getContextualFeed(tenantId, userId, limit = 20) {
        // Buscar inferências do usuário
        const inferences = await profile_inference_service_1.profileInferenceService.getInferences(tenantId, userId);
        const userState = inferences.userState;
        // Gerar seções baseadas no estado
        const sections = [];
        // SEÇÃO 1: Conteúdo de Prazer (sempre presente se houver Físico)
        if (inferences.insights.hasPhysicalWithoutLearning || userState === 'explorer' || userState === 'curious') {
            const pleasureContent = await this.generatePleasureContent(tenantId, userId, 5);
            if (pleasureContent.length > 0) {
                sections.push({
                    id: 'pleasure',
                    title: 'Talvez você curta',
                    subtitle: 'Conteúdo leve para o seu momento',
                    contentType: 'pleasure',
                    contents: pleasureContent,
                    priority: 8,
                });
            }
        }
        // SEÇÃO 2: Conteúdo de Aprendizado (se houver Aprendizado ou transição)
        if (userState === 'curious' || userState === 'in_transition' || userState === 'professional_training') {
            const learningContent = await this.generateLearningContent(tenantId, userId, 5);
            if (learningContent.length > 0) {
                sections.push({
                    id: 'learning',
                    title: 'Você pode gostar de explorar',
                    subtitle: 'Conteúdo para seu aprendizado',
                    contentType: 'learning',
                    contents: learningContent,
                    priority: 7,
                });
            }
        }
        // SEÇÃO 3: Conteúdo de Transição (se houver inferência de transição)
        if (inferences.suggestions.length > 0) {
            const transitionContent = await this.generateTransitionContent(tenantId, userId, 3);
            if (transitionContent.length > 0) {
                sections.push({
                    id: 'transition',
                    title: 'Histórias reais',
                    subtitle: 'Pessoas que trilharam caminhos parecidos',
                    contentType: 'transition',
                    contents: transitionContent,
                    priority: 6,
                });
            }
        }
        // SEÇÃO 4: Conteúdo Humano (pessoas com afinidade)
        if (userState !== 'explorer') {
            const humanContent = await this.generateHumanContent(tenantId, userId, 4);
            if (humanContent.length > 0) {
                sections.push({
                    id: 'human',
                    title: 'Pessoas em algo parecido',
                    subtitle: 'Gente explorando caminhos similares',
                    contentType: 'human',
                    contents: humanContent,
                    priority: 5,
                });
            }
        }
        // Ordenar seções por prioridade
        sections.sort((a, b) => b.priority - a.priority);
        // Gerar header contextual
        const contextHeader = this.generateContextHeader(userState, inferences);
        return {
            userState,
            contextHeader,
            sections,
            hasMore: false, // Por enquanto, sempre false
        };
    }
    /**
     * Gera conteúdo de prazer (Físico)
     */
    async generatePleasureContent(tenantId, userId, limit) {
        // Por enquanto, retorna conteúdo mockado
        // Em produção, buscaria de uma tabela de conteúdos ou API externa
        return [
            {
                id: 'pleasure_1',
                type: 'pleasure',
                title: '5 formas de relaxar sem sair de casa',
                description: 'Atividades simples para desacelerar no seu tempo',
                metadata: {
                    tags: ['relaxar', 'bem-estar'],
                    estimatedReadTime: 3,
                },
                createdAt: new Date().toISOString(),
                priority: 8,
            },
            {
                id: 'pleasure_2',
                type: 'pleasure',
                title: 'Receitas rápidas para cozinhar por prazer',
                description: 'Pratos simples que fazem o momento valer a pena',
                metadata: {
                    tags: ['culinária', 'prazer'],
                    estimatedReadTime: 5,
                },
                createdAt: new Date().toISOString(),
                priority: 7,
            },
        ];
    }
    /**
     * Gera conteúdo de aprendizado
     */
    async generateLearningContent(tenantId, userId, limit) {
        return [
            {
                id: 'learning_1',
                type: 'learning',
                title: 'Dicas para começar a aprender algo novo',
                description: 'Um guia leve para explorar novos temas',
                metadata: {
                    tags: ['aprendizado', 'dicas'],
                    estimatedReadTime: 4,
                },
                createdAt: new Date().toISOString(),
                priority: 7,
            },
            {
                id: 'learning_2',
                type: 'learning',
                title: 'Como manter o ritmo de aprendizado',
                description: 'Sem pressão, no seu tempo',
                metadata: {
                    tags: ['aprendizado', 'ritmo'],
                    estimatedReadTime: 3,
                },
                createdAt: new Date().toISOString(),
                priority: 6,
            },
        ];
    }
    /**
     * Gera conteúdo de transição (histórias, trajetórias)
     */
    async generateTransitionContent(tenantId, userId, limit) {
        return [
            {
                id: 'transition_1',
                type: 'transition',
                title: 'Como transformei um hobby em aprendizado',
                description: 'Uma história real de alguém que seguiu esse caminho',
                author: {
                    id: 'user_1',
                    name: 'Maria Silva',
                },
                metadata: {
                    tags: ['história', 'transição'],
                    estimatedReadTime: 5,
                },
                createdAt: new Date().toISOString(),
                priority: 8,
            },
        ];
    }
    /**
     * Gera conteúdo humano (pessoas com afinidade)
     */
    async generateHumanContent(tenantId, userId, limit) {
        // Por enquanto, retorna vazio
        // Em produção, buscaria usuários com afinidade baseada no estado
        return [];
    }
    /**
     * Gera header contextual baseado no estado
     */
    generateContextHeader(userState, inferences) {
        switch (userState) {
            case 'explorer':
                return 'Hoje seu perfil está mais voltado para explorar e descobrir.';
            case 'curious':
                return 'Você está explorando e aprendendo ao mesmo tempo.';
            case 'in_transition':
                return 'Você está em um momento de transição e crescimento.';
            case 'professional_training':
                return 'Você está construindo sua trajetória profissional.';
            case 'professional_stable':
                return 'Você está focado no seu trabalho.';
            case 'at_risk':
                return undefined; // Não mencionar estado de risco explicitamente
            default:
                return undefined;
        }
    }
}
exports.feedService = new FeedService();
//# sourceMappingURL=feed.service.js.map