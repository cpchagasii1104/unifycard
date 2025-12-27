export interface CompleteProfile {
    actor: {
        actor_id: string;
        actor_type: string;
        display_name: string;
        avatar_url: string | null;
        cover_url: string | null;
        bio: string | null;
    } | null;
    personal_profile: {
        fullName: string | null;
        phone: string | null;
        metadata: Record<string, any>;
    } | null;
    professional_profile: {
        skills: any[];
        education: any[];
        bio: string | null;
        availability: string | null;
    } | null;
    physical_profile: {
        interests: any[];
        lifestyle: {
            drinks: string | null;
            smokes: string | null;
            relationshipStatus: string | null;
            sexualOrientation: string | null;
        };
        preferences: Record<string, any>;
    } | null;
    addresses: Array<{
        address_id: string;
        cep: string | null;
        address: string | null;
        address_number: string | null;
        complement: string | null;
        neighborhood: string | null;
        city: string | null;
        state: string | null;
        country: string | null;
        is_primary: boolean;
    }>;
    contacts: Array<{
        contact_id: string;
        type: string;
        value: string;
        is_primary: boolean;
    }>;
    interests: Array<{
        interest_id: string;
        name: string;
        category: string | null;
    }>;
    companies: Array<{
        company_id: string;
        company_name: string;
        trade_name: string | null;
        cnpj: string | null;
        is_verified: boolean;
    }>;
}
export declare class CoreService {
    /**
     * Busca perfil completo agregando dados de todos os módulos
     * NUNCA retorna erro se uma parte estiver vazia - retorna null ou array vazio
     */
    getCompleteProfile(tenantId: string, userId: string, globalUserId: string): Promise<CompleteProfile>;
}
export declare const coreService: CoreService;
//# sourceMappingURL=core.service.d.ts.map