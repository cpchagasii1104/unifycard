import type { PhysicalProfile, UpdatePhysicalProfileInput } from './profile-physical.types';
declare class ProfilePhysicalService {
    /**
     * Busca perfil físico/interesses do usuário
     */
    getPhysicalProfile(tenantId: string, userId: string): Promise<PhysicalProfile | null>;
    /**
     * Atualiza perfil físico/interesses
     */
    updatePhysicalProfile(tenantId: string, userId: string, input: UpdatePhysicalProfileInput): Promise<PhysicalProfile>;
}
export declare const profilePhysicalService: ProfilePhysicalService;
export {};
//# sourceMappingURL=profile-physical.service.d.ts.map