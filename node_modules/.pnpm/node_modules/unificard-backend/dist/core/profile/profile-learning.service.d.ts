import type { LearningProfile, UpdateLearningProfileInput } from './profile-learning.types';
declare class ProfileLearningService {
    /**
     * Busca perfil de aprendizado do usuário
     */
    getLearningProfile(tenantId: string, userId: string): Promise<LearningProfile | null>;
    /**
     * Atualiza perfil de aprendizado
     */
    updateLearningProfile(tenantId: string, userId: string, input: UpdateLearningProfileInput): Promise<LearningProfile>;
}
export declare const profileLearningService: ProfileLearningService;
export {};
//# sourceMappingURL=profile-learning.service.d.ts.map