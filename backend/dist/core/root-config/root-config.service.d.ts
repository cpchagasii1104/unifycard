import type { RootConfig, UpdateRootConfigInput } from './root-config.types';
declare class RootConfigService {
    private repository;
    /**
     * Busca a configuração-raiz atual
     */
    getConfig(): Promise<RootConfig | null>;
    /**
     * Atualiza a configuração-raiz
     */
    updateConfig(input: UpdateRootConfigInput): Promise<RootConfig>;
    /**
     * Define a região (país, estado, cidade)
     */
    setRegion(countryId?: string | null, stateId?: string | null, cityId?: string | null): Promise<RootConfig>;
    /**
     * Define o timezone
     */
    setTimezone(timezone: string): Promise<RootConfig>;
    /**
     * Define a moeda
     */
    setCurrency(currency: string): Promise<RootConfig>;
    /**
     * Define os idiomas
     */
    setLanguages(languages: string[]): Promise<RootConfig>;
}
export declare const rootConfigService: RootConfigService;
export {};
//# sourceMappingURL=root-config.service.d.ts.map