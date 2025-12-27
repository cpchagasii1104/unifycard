import type { UserResidence, SetResidenceInput, ResidenceResponse } from './residence.types';
declare class ResidenceService {
    private toUserResidence;
    /**
     * Busca residência digital de um usuário global
     */
    getUserResidence(globalUserId: string): Promise<UserResidence | null>;
    /**
     * Define ou atualiza residência digital de um usuário
     */
    setUserResidence(globalUserId: string, input: SetResidenceInput): Promise<UserResidence>;
    /**
     * Define apenas preferências (timezone, currency, languages)
     */
    setResidencePreferences(globalUserId: string, preferences: {
        timezone?: string | null;
        currency?: string;
        languages?: string[];
    }): Promise<UserResidence>;
    /**
     * Define automaticamente residência a partir do root-config
     * Usado quando usuário é criado e ainda não tem residência
     */
    autoSetFromRootConfig(globalUserId: string): Promise<UserResidence>;
    /**
     * Busca residência com dados completos (incluindo nomes de país/estado/cidade)
     */
    getResidenceWithDetails(globalUserId: string): Promise<ResidenceResponse | null>;
}
export declare const residenceService: ResidenceService;
export {};
//# sourceMappingURL=residence.service.d.ts.map