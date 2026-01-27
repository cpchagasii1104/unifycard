"use strict";
// src/modules/social/social-targeting.service.ts
// Serviço de direcionamento inteligente baseado no Raio-X do CORE
Object.defineProperty(exports, "__esModule", { value: true });
exports.socialTargetingService = exports.SocialTargetingService = void 0;
class SocialTargetingService {
    /**
     * Calcula score de relevância baseado no Raio-X do CORE
     * REGRA: Targeting é SOFT (ranking), não bloqueio duro
     */
    calculateRelevanceScore(targeting, userCoreProfile, isFollowed, userAge) {
        const breakdown = {};
        let totalScore = 50; // Score base (nunca zero)
        // 1. Social Affinity (seguir o actor) - peso alto
        if (isFollowed) {
            breakdown.social_affinity = 30;
            totalScore += 30;
        }
        // 2. Demographics (idade, gênero)
        if (targeting?.demographics) {
            let demoScore = 0;
            const { age_range, gender } = targeting.demographics;
            // Idade
            if (age_range && userAge !== undefined) {
                const [minAge, maxAge] = age_range;
                if (userAge >= minAge && userAge <= maxAge) {
                    demoScore += 10;
                }
                else {
                    // Penalidade suave se fora do range
                    demoScore -= 5;
                }
            }
            // Gênero
            if (gender && gender.length > 0) {
                const userGender = userCoreProfile.personal_profile?.metadata?.gender;
                if (userGender && gender.includes(userGender)) {
                    demoScore += 5;
                }
            }
            breakdown.demographics = Math.max(0, demoScore);
            totalScore += breakdown.demographics;
        }
        // 3. Lifestyle
        if (targeting?.lifestyle) {
            let lifestyleScore = 0;
            const userLifestyle = userCoreProfile.physical_profile?.lifestyle;
            if (targeting.lifestyle.drinks !== undefined && userLifestyle?.drinks) {
                // Match simples (pode ser refinado)
                lifestyleScore += 3;
            }
            if (targeting.lifestyle.smokes !== undefined && userLifestyle?.smokes) {
                lifestyleScore += 3;
            }
            breakdown.lifestyle = lifestyleScore;
            totalScore += breakdown.lifestyle;
        }
        // 4. Interests (match de interesses do CORE)
        if (targeting?.interests && targeting.interests.length > 0) {
            const userInterests = userCoreProfile.interests || [];
            const userInterestIds = userInterests.map((i) => i.interest_id);
            const matches = targeting.interests.filter((targetInterestId) => userInterestIds.includes(targetInterestId)).length;
            if (matches > 0) {
                // Score proporcional ao número de matches
                breakdown.interest_match = Math.min(20, (matches / targeting.interests.length) * 20);
                totalScore += breakdown.interest_match;
            }
        }
        // 5. Professions (match de profissões/habilidades do CORE)
        // 🔴 BLINDAGEM: Usa apenas professional_profile.skills (atuação real)
        // Educação NÃO participa de targeting - é apenas informacional
        if (targeting?.professions && targeting.professions.length > 0) {
            const userSkills = userCoreProfile.professional_profile?.skills || [];
            const userCategoryIds = userSkills.map((s) => s.categoryId || s.category_id);
            const matches = targeting.professions.filter((targetProfId) => userCategoryIds.includes(targetProfId)).length;
            if (matches > 0) {
                breakdown.intent_match = Math.min(15, (matches / targeting.professions.length) * 15);
                totalScore += breakdown.intent_match;
            }
        }
        // 🔴 BLINDAGEM EXPLÍCITA: Educação NÃO participa de targeting
        // Por que isso NÃO pode virar decisão:
        // - Educação não filtra vagas, não bloqueia oportunidades
        // - Targeting usa apenas: profissão declarada, interesses, demografia, lifestyle
        // - education_profile existe em userCoreProfile mas é ignorado intencionalmente
        // 6. Proximity (localização) - simplificado por enquanto
        if (targeting?.locations) {
            // TODO: Implementar cálculo de distância real quando houver dados de localização
            breakdown.proximity = 5; // Score base para posts com localização
            totalScore += breakdown.proximity;
        }
        // Garantir que score está entre 0 e 100
        const finalScore = Math.max(0, Math.min(100, totalScore));
        return {
            score: finalScore,
            breakdown,
        };
    }
    /**
     * Valida se targeting é válido (não bloqueia, apenas valida estrutura)
     */
    validateTargeting(targeting) {
        if (!targeting || typeof targeting !== 'object') {
            return false;
        }
        // Validar estrutura básica (não muito restritivo)
        if (targeting.demographics) {
            if (targeting.demographics.age_range && !Array.isArray(targeting.demographics.age_range)) {
                return false;
            }
        }
        return true;
    }
    /**
     * Ordena posts por relevância mantendo 20% de discovery
     * REGRA: Nunca exclui completamente usuário por não bater 100% no targeting
     */
    rankPosts(posts, discoveryPercentage = 20) {
        if (posts.length === 0) {
            return [];
        }
        // Ordenar por relevância (seguidos primeiro, depois score)
        const sorted = [...posts].sort((a, b) => {
            // Priorizar posts seguidos
            if (a.is_followed !== b.is_followed) {
                return b.is_followed ? 1 : -1;
            }
            // Depois por score
            if (b.relevance_score !== a.relevance_score) {
                return b.relevance_score - a.relevance_score;
            }
            // Por último por data
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        // Separar alta relevância e discovery
        const discoveryCount = Math.max(1, Math.floor(sorted.length * (discoveryPercentage / 100)));
        const highRelevance = sorted.slice(0, sorted.length - discoveryCount);
        const discovery = sorted.slice(-discoveryCount);
        // Misturar: alta relevância primeiro, depois discovery
        return [...highRelevance, ...discovery];
    }
}
exports.SocialTargetingService = SocialTargetingService;
exports.socialTargetingService = new SocialTargetingService();
