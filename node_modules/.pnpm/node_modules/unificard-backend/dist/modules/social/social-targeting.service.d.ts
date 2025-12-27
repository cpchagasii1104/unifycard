import type { CompleteProfile } from '@core/core.service';
export interface TargetingFilters {
    demographics?: {
        age_range?: [number, number];
        gender?: ('male' | 'female' | 'other')[];
    };
    lifestyle?: {
        drinks?: boolean;
        smokes?: boolean;
    };
    mobility?: {
        has_car?: boolean;
        uses_bike?: boolean;
        uses_skate?: boolean;
    };
    interests?: string[];
    professions?: string[];
    locations?: {
        radius_km?: number;
        city_id?: string;
    };
}
export interface RelevanceScore {
    score: number;
    breakdown: {
        intent_match?: number;
        interest_match?: number;
        proximity?: number;
        social_affinity?: number;
        demographics?: number;
        lifestyle?: number;
    };
}
export declare class SocialTargetingService {
    /**
     * Calcula score de relevância baseado no Raio-X do CORE
     * REGRA: Targeting é SOFT (ranking), não bloqueio duro
     */
    calculateRelevanceScore(targeting: TargetingFilters | null, userCoreProfile: CompleteProfile, isFollowed: boolean, userAge?: number): RelevanceScore;
    /**
     * Valida se targeting é válido (não bloqueia, apenas valida estrutura)
     */
    validateTargeting(targeting: any): targeting is TargetingFilters;
    /**
     * Ordena posts por relevância mantendo 20% de discovery
     * REGRA: Nunca exclui completamente usuário por não bater 100% no targeting
     */
    rankPosts(posts: Array<{
        relevance_score: number;
        is_followed?: boolean;
        created_at: string;
    }>, discoveryPercentage?: number): Array<{
        relevance_score: number;
        is_followed?: boolean;
        created_at: string;
    }>;
}
export declare const socialTargetingService: SocialTargetingService;
//# sourceMappingURL=social-targeting.service.d.ts.map