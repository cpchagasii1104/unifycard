import type { GlobalUser, UserIdentityLink, UpdateGlobalIdentityInput, IdentityProfile } from './identity.types';
declare class IdentityService {
    private toGlobalUser;
    private toUserIdentityLink;
    /**
     * Cria uma identidade global para um usuário local
     */
    createGlobalIdentityForUser(userId: string, tenantId: string): Promise<GlobalUser>;
    /**
     * Busca identidade global por ID
     */
    getGlobalIdentity(globalUserId: string): Promise<GlobalUser | null>;
    /**
     * Atualiza identidade global
     */
    updateGlobalIdentity(globalUserId: string, updates: UpdateGlobalIdentityInput): Promise<GlobalUser>;
    /**
     * Liga um usuário local a uma identidade global
     */
    linkLocalUserToGlobal(userId: string, globalUserId: string, tenantId: string): Promise<UserIdentityLink>;
    /**
     * Busca perfil completo (global + local) do usuário
     */
    getIdentityProfile(userId: string, tenantId: string): Promise<IdentityProfile | null>;
}
export declare const identityService: IdentityService;
export {};
//# sourceMappingURL=identity.service.d.ts.map