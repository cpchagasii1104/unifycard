"use strict";
// src/core/matching/matching.service.ts
// Serviço de Matching Humano - conexão por momento de vida
//
// 🔴 BLINDAGEM CANÔNICA: Educação NÃO participa de matching
// - Matching usa apenas: estado inferido, afinidade física/aprendizado/profissional
// - Educação é apenas informacional, não filtra conexões
// - Por que isso NÃO pode virar decisão: educação não define compatibilidade
//
// 🔴 BLINDAGEM CANÔNICA: Aprendizado representa direção e interesse declarado
// - Matching é baseado em direção/interesse similar, não em capacidade/nível
// - Progresso (beginner/intermediate/advanced) representa fase de exploração, não validação
// - NÃO filtra conexões por progresso, apenas sugere baseado em interesse similar
// - Por que isso NÃO pode virar decisão: aprendizado é autodireção, não validação de competência
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchingService = void 0;
const profile_inference_service_1 = require("../profile/profile-inference.service");
class MatchingService {
    /**
     * Gera sugestões de matching baseadas no estado e afinidade
     */
    async getMatchingSuggestions(tenantId, userId, limit = 5) {
        // Buscar inferências do usuário atual
        const userInferences = await profile_inference_service_1.profileInferenceService.getInferences(tenantId, userId);
        const userState = userInferences.userState;
        // Gerar sugestões baseadas no estado
        const suggestions = [];
        // MATCHING 1: Exploração (para exploradores e curiosos)
        if (userState === 'explorer' || userState === 'curious') {
            const explorationMatches = await this.generateExplorationMatches(tenantId, userId, userState, 2);
            suggestions.push(...explorationMatches);
        }
        // MATCHING 2: Aprendizado (para curiosos, em transição, em formação)
        if (userState === 'curious' || userState === 'in_transition' || userState === 'professional_training') {
            const learningMatches = await this.generateLearningMatches(tenantId, userId, userState, 2);
            suggestions.push(...learningMatches);
        }
        // MATCHING 3: Espelhamento (para profissionais estáveis ou em risco)
        if (userState === 'professional_stable' || userState === 'at_risk') {
            const mirroringMatches = await this.generateMirroringMatches(tenantId, userId, userState, 1);
            suggestions.push(...mirroringMatches);
        }
        // Ordenar por prioridade
        suggestions.sort((a, b) => b.priority - a.priority);
        // Limitar quantidade
        const limitedSuggestions = suggestions.slice(0, limit);
        return {
            suggestions: limitedSuggestions,
            hasMore: suggestions.length > limit,
        };
    }
    /**
     * Gera matches de exploração
     */
    async generateExplorationMatches(tenantId, userId, userState, limit) {
        // Por enquanto, retorna matches mockados
        // Em produção, buscaria usuários com estado similar e afinidade de Físico
        return [
            {
                id: 'exploration_1',
                type: 'exploration',
                users: [
                    {
                        userId: 'user_2',
                        name: 'Ana Costa',
                        state: 'explorer',
                        affinity: {
                            physical: ['criar-expressar', 'cozinhar-comer'],
                        },
                        lastActivity: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                    },
                ],
                title: 'Pessoas explorando algo parecido',
                message: 'Tem gente descobrindo coisas similares ao que você curte.',
                affinityScore: 7,
                priority: 8,
                createdAt: new Date().toISOString(),
            },
        ];
    }
    /**
     * Gera matches de aprendizado
     */
    async generateLearningMatches(tenantId, userId, userState, limit) {
        return [
            {
                id: 'learning_1',
                type: 'learning',
                users: [
                    {
                        userId: 'user_3',
                        name: 'Carlos Mendes',
                        state: 'curious',
                        affinity: {
                            learning: ['fotografia-aprendizado', 'escrita-criativa'],
                        },
                        lastActivity: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
                    },
                ],
                title: 'Gente aprendendo isso também',
                message: 'Alguém está explorando caminhos parecidos com os seus.',
                affinityScore: 8,
                priority: 7,
                createdAt: new Date().toISOString(),
            },
        ];
    }
    /**
     * Gera matches de espelhamento
     */
    async generateMirroringMatches(tenantId, userId, userState, limit) {
        return [
            {
                id: 'mirroring_1',
                type: 'mirroring',
                users: [
                    {
                        userId: 'user_4',
                        name: 'Patricia Lima',
                        state: 'professional_stable',
                        affinity: {
                            professional: ['designer', 'criador-conteudo'],
                        },
                        lastActivity: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
                    },
                ],
                title: 'Histórias que podem te interessar',
                message: 'Alguém com uma trajetória parecida com a sua.',
                affinityScore: 6,
                priority: 6,
                createdAt: new Date().toISOString(),
            },
        ];
    }
    /**
     * Registra ação do usuário sobre uma sugestão de match
     */
    async recordMatchAction(tenantId, userId, matchId, action) {
        // Por enquanto, apenas log
        // Em produção, salvaria no metadata do usuário para não reaparecer
        console.log(`[MATCHING] User ${userId} ${action}ed match ${matchId}`);
    }
    /**
     * Verifica se um match já foi dispensado
     */
    async isMatchDismissed(tenantId, userId, matchId) {
        // Por enquanto, retorna false
        // Em produção, verificaria no metadata do usuário
        return false;
    }
}
exports.matchingService = new MatchingService();
