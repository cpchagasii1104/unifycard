import type { ProfessionalProfile, UpdateProfessionalProfileInput } from './profile-professional.types';
declare class ProfileProfessionalService {
    /**
     * Busca perfil profissional do usuário
     */
    getProfessionalProfile(tenantId: string, userId: string): Promise<ProfessionalProfile | null>;
    /**
     * Atualiza perfil profissional
     */
    updateProfessionalProfile(tenantId: string, userId: string, input: UpdateProfessionalProfileInput): Promise<ProfessionalProfile>;
}
export declare const profileProfessionalService: ProfileProfessionalService;
export {};
//# sourceMappingURL=profile-professional.service.d.ts.map