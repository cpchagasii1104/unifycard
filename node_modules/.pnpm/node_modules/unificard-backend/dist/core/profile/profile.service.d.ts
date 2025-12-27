import type { Profile, UpdateProfileInput } from './profile.types';
declare class ProfileService {
    private toProfile;
    /**
     * Busca perfil de um usuário
     */
    getProfile(tenantId: string, userId: string): Promise<Profile | null>;
    /**
     * Cria perfil se não existir (READ-ONLY para GET)
     * NUNCA sobrescreve dados existentes
     */
    createProfileIfNotExists(tenantId: string, userId: string): Promise<Profile>;
    /**
     * Cria ou atualiza perfil de um usuário
     * ⚠️ SÓ DEVE SER CHAMADO DE ENDPOINTS EXPLÍCITOS DE UPDATE
     */
    upsertProfile(tenantId: string, userId: string, input: UpdateProfileInput): Promise<Profile>;
}
export declare const profileService: ProfileService;
export {};
//# sourceMappingURL=profile.service.d.ts.map