"use strict";
// src/core/opportunity/opportunity.service.ts
// Serviço de Oportunidades Suaves - possibilidades no tempo certo
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
exports.opportunityService = void 0;
const profile_inference_service_1 = require("../profile/profile-inference.service");
// Import dinâmico para evitar dependência circular
const getProfileLearningService = async () => {
    const { profileLearningService } = await Promise.resolve().then(() => __importStar(require('../profile/profile-learning.service')));
    return profileLearningService;
};
class OpportunityService {
    /**
     * Gera oportunidades contextuais baseadas no estado e progresso do usuário
     * REGRA DURA: Só aparece se:
     * - Aprendizado ativo
     * - Progresso >= Intermediário
     * - Afinidade clara com área profissional
     */
    async getContextualOpportunities(tenantId, userId, limit = 3) {
        // Buscar inferências do usuário
        const inferences = await profile_inference_service_1.profileInferenceService.getInferences(tenantId, userId);
        // Buscar perfil de aprendizado
        const profileLearningServiceInstance = await getProfileLearningService();
        const learningProfile = await profileLearningServiceInstance.getLearningProfile(tenantId, userId);
        // VALIDAÇÃO: Verificar se condições são atendidas
        if (!learningProfile) {
            return {
                opportunities: [],
                hasMore: false,
            };
        }
        const hasActiveLearning = learningProfile.learnings.length > 0;
        const hasIntermediateOrAdvanced = learningProfile.learnings.some(l => l.preferences?.progress === 'intermediate' || l.preferences?.progress === 'advanced');
        const hasProfessionalAffinity = inferences.insights.hasLearningWithoutProfessional ||
            inferences.userState === 'professional_training';
        // Se qualquer condição falhar → não retorna oportunidades
        if (!hasActiveLearning || !hasIntermediateOrAdvanced || !hasProfessionalAffinity) {
            return {
                opportunities: [],
                hasMore: false,
            };
        }
        // Gerar oportunidades baseadas no tipo
        const opportunities = [];
        // OPORTUNIDADE 1: Exploratória (para quem está em transição)
        if (inferences.userState === 'in_transition' || inferences.userState === 'curious') {
            const exploratory = await this.generateExploratoryOpportunities(tenantId, userId, learningProfile, 1);
            opportunities.push(...exploratory);
        }
        // OPORTUNIDADE 2: Comunitária (para quem quer pertencer)
        if (inferences.userState === 'curious' || inferences.userState === 'professional_training') {
            const community = await this.generateCommunityOpportunities(tenantId, userId, learningProfile, 1);
            opportunities.push(...community);
        }
        // OPORTUNIDADE 3: Profissional Suave (para quem já está pronto)
        if (inferences.userState === 'professional_training' ||
            (hasIntermediateOrAdvanced && inferences.insights.hasLearningWithoutProfessional)) {
            const professional = await this.generateProfessionalOpportunities(tenantId, userId, learningProfile, 1);
            opportunities.push(...professional);
        }
        // Ordenar por prioridade
        opportunities.sort((a, b) => b.priority - a.priority);
        // Limitar quantidade
        const limitedOpportunities = opportunities.slice(0, limit);
        return {
            opportunities: limitedOpportunities,
            hasMore: opportunities.length > limit,
        };
    }
    /**
     * Gera oportunidades exploratórias
     */
    async generateExploratoryOpportunities(tenantId, userId, learningProfile, limit) {
        // Por enquanto, retorna oportunidades mockadas
        // Em produção, buscaria de uma tabela de oportunidades ou API externa
        return [
            {
                id: 'exploratory_1',
                type: 'exploratory',
                title: 'Projeto colaborativo em fotografia',
                description: 'Um grupo está criando um projeto coletivo. Você pode participar quando quiser, sem compromisso.',
                category: {
                    id: 'fotografia-aprendizado',
                    name: 'Fotografia',
                },
                metadata: {
                    isPaid: false,
                    isRemote: true,
                    estimatedTime: '2-4 horas/semana',
                    tags: ['colaboração', 'aprendizado', 'fotografia'],
                },
                priority: 7,
                createdAt: new Date().toISOString(),
            },
        ];
    }
    /**
     * Gera oportunidades comunitárias
     */
    async generateCommunityOpportunities(tenantId, userId, learningProfile, limit) {
        return [
            {
                id: 'community_1',
                type: 'community',
                title: 'Grupo de pessoas aprendendo design',
                description: 'Uma comunidade pequena de pessoas explorando design. Ambiente leve, sem pressão.',
                category: {
                    id: 'design-aprendizado',
                    name: 'Design',
                },
                metadata: {
                    isPaid: false,
                    tags: ['comunidade', 'design', 'aprendizado'],
                },
                priority: 6,
                createdAt: new Date().toISOString(),
            },
        ];
    }
    /**
     * Gera oportunidades profissionais suaves
     */
    async generateProfessionalOpportunities(tenantId, userId, learningProfile, limit) {
        return [
            {
                id: 'professional_1',
                type: 'professional',
                title: 'Parceria em projeto de conteúdo',
                description: 'Alguém está procurando colaboração para um projeto. Pode ser interessante para você.',
                category: {
                    id: 'criacao-conteudo-aprendizado',
                    name: 'Criação de Conteúdo',
                },
                metadata: {
                    isPaid: true,
                    isRemote: true,
                    estimatedTime: '5-10 horas/semana',
                    tags: ['parceria', 'projeto', 'conteúdo'],
                },
                priority: 8,
                createdAt: new Date().toISOString(),
            },
        ];
    }
    /**
     * Registra ação do usuário sobre uma oportunidade
     */
    async recordOpportunityAction(tenantId, userId, opportunityId, action) {
        // Por enquanto, apenas log
        // Em produção, salvaria no metadata do usuário para não reaparecer
        console.log(`[OPPORTUNITY] User ${userId} ${action}ed opportunity ${opportunityId}`);
    }
    /**
     * Verifica se uma oportunidade já foi dispensada
     */
    async isOpportunityDismissed(tenantId, userId, opportunityId) {
        // Por enquanto, retorna false
        // Em produção, verificaria no metadata do usuário
        return false;
    }
}
exports.opportunityService = new OpportunityService();
//# sourceMappingURL=opportunity.service.js.map